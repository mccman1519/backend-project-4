import axios from 'axios';
import * as fs from 'node:fs/promises';
import path from 'node:path';

const isValidHttpUrl = (string) => {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
};

export default class PageLoader {
  loadPage(url) {
    if (!isValidHttpUrl(url)) {
      return Promise.reject(
        new TypeError('Invalid URL (maybe forget protocol?)')
      );
    }

    this.url = url;

    return axios.get(url).then(({ data }) => {
      this.data = data;
      return data;
    });
  }

  save(filePath) {
    const docName =
      this.url.split('://')[1].replace(/[^0-9a-z]/gim, '-') + '.html';
    const fileName = path.join(filePath, docName);

    if (!this.data) {
      throw new ReferenceError(
        'There is no data available. The document must be loaded before saving'
      );
    }

    return fs.writeFile(fileName, this.data, 'utf-8').then(() => fileName);
  }
}