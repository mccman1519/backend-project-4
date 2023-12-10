import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'node:fs/promises';
import {
  isValidHttpUrl,
  getTopDomainName,
  makeLocalFilename,
  makeValidURLFromSrc,
} from './utils.js';
import path from 'node:path';
// import mime from 'mime';
import debug from 'debug';
import 'axios-debug-log';
import { errorHandler } from './errors/errors.js';

axios.interceptors.response.use(
  (response) => {
    if (response.status !== 200) throw new Error('Status is not 200');
    return response;
  },
  (error) => {
    errorHandler(error);
  }
);

const log = debug('page-loader');

export default class PageLoader {
  constructor(url, filePath) {
    if (!isValidHttpUrl(url)) {
      throw new TypeError('Invalid URL (maybe forget protocol?)');
    }

    this.url = new URL(url);
    this.filePath = filePath;
    this.docName =
      this.url.href.split('://')[1].replace(/[^0-9a-z]/gim, '-') + '.html';
    this.docFilename = path.join(this.filePath, this.docName);
    this.filesDirName = path.join(
      this.filePath,
      path.basename(this.docName, '.html') + '_files'
    );
  }

  #loadResources(selector, pageData, timeout) {
    let srcType;
    let responseType;
    let encoding;
    switch (selector) {
      case 'img':
        srcType = 'src';
        responseType = 'stream';
        encoding = 'binary';
        break;
      case 'script':
        srcType = 'src';
        responseType = 'text';
        encoding = 'utf-8';
        break;
      case 'link':
        srcType = 'href';
        responseType = 'text';
        encoding = 'utf-8';
        break;
      default:
        throw new TypeError(`Unsupported resource type: ${selector}`);
    }

    const $ = cheerio.load(pageData);
    let promises = [];

    $(selector).each((i, resource) => {
      const attrSrc = $(resource).attr(srcType);
      const validSrc = makeValidURLFromSrc(attrSrc, this.url);

      if (validSrc.hostname === this.url.hostname) {
        const promise = new Promise((resolve, reject) => {
          log(`Downloading ${validSrc}...`);

          axios({
            method: 'get',
            url: validSrc.toString(),
            responseType,
            timeout,
          })
            .then((response) => {
              let { absFilename } = makeLocalFilename(
                validSrc,
                this.filesDirName
              );
              // в link может быть какой угодно ресурс - как выбрать расширение файла и нужно ли вообще,
              // если его нет в атрибуте href?
              // о типе файла должен говорить rel и/или type
              // https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel
              const relValue = $(resource).attr('rel');
              if (selector === 'link' && relValue === 'canonical') {
                absFilename = `${absFilename}.html`;
              }
              fs.mkdir(this.filesDirName)
                // Skip dir already exist error
                .catch(() => {})
                .then(() => {
                  resolve(
                    fs
                      .writeFile(absFilename, response.data, encoding)
                      .catch((err) => errorHandler(err))
                  );
                });
            })
            .catch((err) => {
              reject(err);
            });
        });
        promises = [...promises, promise];
      } else {
        log(`Skipped external URL ${validSrc.href}`);
      }
    });

    return promises;
  }

  load(tag, pageData, timeout = 1000) {
    return Promise.all(this.#loadResources(tag, pageData, timeout));
  }

  patch(pageData) {
    const mapping = {
      img: 'src',
      link: 'href',
      script: 'src',
    };
    const $ = cheerio.load(pageData);

    Object.entries(mapping).forEach(([selector, attrName]) => {
      $(selector).each((i, item) => {
        const attrSrc = $(item).attr(attrName);
        const validSrc = makeValidURLFromSrc(attrSrc, this.url);

        // Don't touch external urls and non-existant attributes
        if (
          validSrc.hostname === this.url.hostname &&
          $(item).attr(attrName) !== undefined
        ) {
          const src = makeValidURLFromSrc($(item).attr(attrName), this.url);
          let { relFilename } = makeLocalFilename(src, this.filesDirName);

          if (selector === 'link' && $(item).attr('rel') === 'canonical') {
            relFilename = `${relFilename}.html`;
          }
          $(item).attr(attrName, relFilename);
        }
      });
    });

    return $.html();
  }

  loadPage() {
    const fileName = path.join(this.filePath, this.docName);

    return axios.get(this.url).then(({ data, status }) => {
      if (status !== 200) throw new AxiosError();
      const patchedData = this.patch(data);
      return fs
        .writeFile(fileName, patchedData, 'utf-8')
        .then(() => ({ fileName, data }))
        .catch((err) => errorHandler(err));
    });
  }
}
