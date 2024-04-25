/* eslint-disable import/first */
/* eslint-disable implicit-arrow-linebreak */

import { createRequire } from 'module';
import logger from 'debug';

const require = createRequire(import.meta.url);
require('axios-debug-log');
// import axios, { AxiosError } from 'axios';

import * as cheerio from 'cheerio';
import * as fs from 'node:fs/promises';
import { URL } from 'node:url';
import path from 'node:path';
import { makeLocalFilename, makeValidURLFromSrc, isValidHttpUrl } from './utils.js';

const axios = require('axios');

const debug = logger('page-loader');

/**
 * TODO: set description
 * @param {*} url 
 * @returns 
 */
const loadDocument = (url/* , outputPath */) => {
  const validUrl = new URL(url);
  // const docName = `${validUrl.href
  //   .split('://')[1]
  //   .replace(/[^0-9a-z]/gim, '-')}.html`;
  // const docFileName = path.join(outputPath, docName);

  return axios // promise
    .get(validUrl)
    .then(({ data: rawHtmlData, status }) => {
      debug('document html data loaded');
      return { rawHtmlData, status };
    });
  // Must transforming to be here? Maybe...
  // Must writing go after all: html data load, resources, html tranfsorm
  // or I can return the raw html data for resource downloading?
/*       fs
        .writeFile(docFileName, data, 'utf-8')
        .then(() => ({ docFileName, rawHtmlData, status }))); */
};

/**
 *  TODO: set description
 * @param {*} param0 
 * @returns 
 */
const transformHtml = ({ rawHtmlData }, pageUrl, filesDirName) => {
  const mapping = {
    img: 'src',
    link: 'href',
    script: 'src',
  };
  const $ = cheerio.load(rawHtmlData);

  Object.entries(mapping).forEach(([selector, attrName]) => {
    $(selector).each((_i, item) => {
      const attrSrc = $(item).attr(attrName);
      const validSrc = makeValidURLFromSrc(attrSrc, pageUrl);

      // Don't touch external urls and non-existant attributes
      if (
        validSrc.hostname === pageUrl.hostname
        && $(item).attr(attrName) !== undefined
      ) {
        const src = makeValidURLFromSrc($(item).attr(attrName), pageUrl);
        let { relFilename } = makeLocalFilename(src, filesDirName);

        if (selector === 'link' && $(item).attr('rel') === 'canonical') {
          relFilename = `${relFilename}.html`;
        }
        $(item).attr(attrName, relFilename);
      }
    });
  });

  debug('html transform successful');

  return $.html();
};

/**
 * Load resource by selector name
 * @param {*} selector 
 * @param {*} pageData 
 * @param {*} url 
 * @param {*} targetDir 
 * @param {*} timeout 
 * @returns 
 */
const loadResources = (selector, { rawHtmlData }, url, targetDir, timeout = 3000) => {
  const resourceMap = {
    img: {
      srcType: 'src',
      responseType: 'stream',
      encoding: 'binary',
    },
    script: {
      srcType: 'src',
      responseType: 'text',
      encoding: 'utf-8',
    },
    link: {
      srcType: 'href',
      responseType: 'text',
      encoding: 'utf-8',
    },
  };

  const { srcType, responseType, encoding } = resourceMap[selector];

  const $ = cheerio.load(rawHtmlData);
  let promises = [];

  $(selector).each((i, resource) => {
    const attrSrc = $(resource).attr(srcType);
    const validAttrSrc = makeValidURLFromSrc(attrSrc, url);

    if (validAttrSrc.hostname === url.hostname) {
      const promise = new Promise((resolve, reject) => {
        debug(`Downloading ${validAttrSrc}...`);

        axios({
          method: 'get',
          url: validAttrSrc.toString(),
          responseType,
          timeout,
        })
          .then((response) => {
            let { absFilename, relFilename } = makeLocalFilename(validAttrSrc, targetDir);
            // в link может быть любой ресурс - как выбрать расширение файла и нужно ли вообще,
            // если его нет в атрибуте href?
            // о типе файла должен говорить rel и/или type
            // https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel
            const relValue = $(resource).attr('rel');
            if (selector === 'link' && relValue === 'canonical') {
              absFilename = `${absFilename}.html`;
            }
            fs.mkdir(targetDir)
              // Skip dir already exist error
              .catch(() => { })
              .then(() => {
                // console.log('FNAME', absFilename);
                // resolve(
                fs
                  .writeFile(absFilename, response.data, encoding)
                  .catch((err) => {
                    debug(`An ERROR on writing ${absFilename}:`, err);
                  })
                  .then(() => resolve([attrSrc, relFilename]));
                // );
              });
          })
          .catch((err) => {
            debug('Axios rejected with ERROR: ', err);
            reject(err);
          });
      });
      promises = [...promises, promise];
    } else {
      debug(`Skipped external URL ${validAttrSrc.href}`);
    }
  });

  return promises;
};

const pageLoader = async (url, outputPath) => {
  if (!isValidHttpUrl(url)) {
    Promise.reject(new TypeError('Invalid URL (maybe forget protocol?)'));
  }

  const urlObject = new URL(url);
  const filePath = outputPath;
  const docName = `${urlObject.href.split('://')[1].replace(/[^0-9a-z]/gim, '-')}.html`;
  const docFilename = path.join(filePath, docName);
  const filesDirName = path.join(filePath, `${path.basename(docName, '.html')}_files`);

  const loadedPageObject = await loadDocument(urlObject.href, outputPath)
    .then((loadResult) => loadResult);

  // console.log(loadedPageObject); <-- OK

  const images = await Promise.allSettled(loadResources('img', loadedPageObject, urlObject, filesDirName));
  const scripts = await Promise.allSettled(loadResources('script', loadedPageObject, urlObject, filesDirName));
  const links = await Promise.allSettled(loadResources('link', loadedPageObject, urlObject, filesDirName));

  // loadResources('img', loadedPageObject, urlObject);
  // console.log(images); // commes as [{status, value: [srcAttr, transformedAttr]},..., {}]
  // console.log(scripts); // commes as [{status, value: [srcAttr, transformedAttr]},..., {}]
  // console.log(links); // commes as [{status, value: [srcAttr, transformedAttr]},..., {}]
  const tranfsormedHtml = transformHtml(loadedPageObject, urlObject, filesDirName);

  fs.writeFile(docFilename, /* loadedPageObject.rawHtmlData */ tranfsormedHtml, 'utf-8');

  return { docFilename, ...loadedPageObject };
};

export { pageLoader, loadDocument };
