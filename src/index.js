/* eslint-disable implicit-arrow-linebreak */

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'node:fs/promises';
import { URL } from 'node:url';
import path from 'node:path';

const loadDocument = (url, outputPath) => {
  const validUrl = new URL(url);
  const docName = `${validUrl.href
    .split('://')[1]
    .replace(/[^0-9a-z]/gim, '-')}.html`;
  const docFileName = path.join(outputPath, docName);

  return axios // promise
    .get(validUrl)
    .then(({ data, status }) =>
      fs
        .writeFile(docFileName, data, 'utf-8')
        .then(() => ({ docFileName, data, status })));
};

const pageLoader = (url, outputPath) => {
  const nameDataStatus = loadDocument(url, outputPath).then((loadResult) => loadResult);

  return nameDataStatus;
};

export { pageLoader, loadDocument };
