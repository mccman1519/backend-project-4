/* eslint-disable import/first */
/* eslint-disable implicit-arrow-linebreak */

import { createRequire } from 'module';
import logger from 'debug';

const require = createRequire(import.meta.url);
require('axios-debug-log');

import { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'node:fs/promises';
import { URL } from 'node:url';
import path from 'node:path';
import { makeLocalFilename, makeValidURLFromSrc, isValidHttpUrl } from './utils.js';
import Listr from 'listr';

const axios = require('axios');

const debug = logger('page-loader');

/**
 * TODO: set description
 * @param {*} url 
 * @returns 
 */
const loadDocument = (url/* , outputPath */) => {
  const validUrl = new URL(url);

  return axios // promise
    .get(validUrl)
    .then(({ data: rawHtmlData, status }) => {
      debug('document html data loaded');
      return { rawHtmlData, status };
    })
    .catch((error) => {
      if (error.response) {
        // Запрос был сделан, и сервер ответил кодом состояния, который
        // выходит за пределы 2xx
        // console.error(error.response.data);
        // console.error(error.response.status);
        // console.error(error.response.headers);
      } else if (error.request) {
        // Запрос был сделан, но ответ не получен
        // `error.request`- это экземпляр XMLHttpRequest в браузере и экземпляр
        // http.ClientRequest в node.js
        // console.error(error.request);
      } else {
        // Произошло что-то при настройке запроса, вызвавшее ошибку
        console.error('Error', error.message);
      }
      // console.error(error.config);

      debug('Axios rejected with ERROR: ', error);
      throw new AxiosError(error.message);
    });
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
            // eslint-disable-next-line prefer-const
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
                  .writeFile(
                    absFilename,
                    typeof response.data === 'string' ? response.data.toString() : response.data,
                    encoding,
                  )
                  .catch((err) => {
                    debug(`An ERROR on writing ${absFilename}:`, err);
                    reject(new Error(`An error on writing file ${absFilename}\nError: ${err}`));
                  })
                  .then(() => resolve([attrSrc, relFilename]));
                // );
              });
          })
          .catch((err) => {
            debug('Axios rejected with ERROR: ', err);
            reject(new AxiosError(err.message));
          });
      });
      promises = [...promises, promise];
    } else {
      debug(`Skipped external URL ${validAttrSrc.href}`);
    }
  });

  return promises;
};

export default async (url, outputPath) => {
  if (!isValidHttpUrl(url)) {
    throw new TypeError('Invalid URL (maybe forget protocol?)');
  }

  const urlObject = new URL(url);
  const filePath = outputPath;
  const docName = `${urlObject.href.split('://')[1].replace(/[^0-9a-z]/gim, '-')}.html`;
  const docFilename = path.join(filePath, docName);
  const filesDirName = path.join(filePath, `${path.basename(docName, '.html')}_files`);

  let loadedPageObject, images, scripts, links, tranfsormedHtml;

  await new Listr([
    {
      title: 'Loading page data',
      task: async () => {
        loadedPageObject = await loadDocument(urlObject.href, outputPath);
      },
    },
    {
      title: 'Loading images',
      task: async () => {
        images = await Promise.allSettled(loadResources('img', loadedPageObject, urlObject, filesDirName));
      },
    },
    {
      title: 'Loading scripts',
      task: async () => {
        scripts = await Promise.allSettled(loadResources('script', loadedPageObject, urlObject, filesDirName));
      },
    },
    {
      title: 'Loading link resources',
      task: async () => {
        links = await Promise.allSettled(loadResources('link', loadedPageObject, urlObject, filesDirName));
      },
    },
    {
      title: 'Transform HTML',
      task: async () => {
        tranfsormedHtml = transformHtml(loadedPageObject, urlObject, filesDirName);
      },
    },
    {
      title: 'Writing on disk',
      task: async () => {
        try {
          await fs.writeFile(docFilename, /* loadedPageObject.rawHtmlData */ tranfsormedHtml, 'utf-8');
        } catch (err) {
          debug(`An ERROR on writing ${docFilename}:`, err);
          throw new Error(`An error on writing file ${docFilename}\nError: ${err}`);
        }
      },
    },
  ]).run().catch((err) => {
    throw err;
  });


  // const images = await Promise.allSettled(loadResources('img', loadedPageObject, urlObject, filesDirName));
  // const scripts = await Promise.allSettled(loadResources('script', loadedPageObject, urlObject, filesDirName));
  // const links = await Promise.allSettled(loadResources('link', loadedPageObject, urlObject, filesDirName));

  // loadResources('img', loadedPageObject, urlObject);
  // console.log(images); // commes as [{status, value: [srcAttr, transformedAttr]},..., {}]
  // console.log(scripts); // commes as [{status, value: [srcAttr, transformedAttr]},..., {}]
  // console.log(links); // commes as [{status, value: [srcAttr, transformedAttr]},..., {}]
  // const tranfsormedHtml = transformHtml(loadedPageObject, urlObject, filesDirName);

  // try {
  //   await fs.writeFile(docFilename, /* loadedPageObject.rawHtmlData */ tranfsormedHtml, 'utf-8');
  // } catch (err) {
  //   debug(`An ERROR on writing ${docFilename}:`, err);
  //   throw new Error(`An error on writing file ${docFilename}\nError: ${err}`);
  // }

  return { docFilename, ...loadedPageObject };
};

// export { pageLoader, loadDocument };
