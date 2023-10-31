import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "node:fs/promises";
import { isValidHttpUrl, getTopDomainName, makeLocalFilename, makeValidURLFromSrc} from './utils.js';
import path from "node:path";


export default class PageLoader {
  constructor(url, filePath) {
    if (!isValidHttpUrl(url)) {
      throw new TypeError('Invalid URL (maybe forget protocol?)');
    }

    this.url = new URL(url);
    this.topDomain = getTopDomainName(this.url.hostname);
    this.filePath = filePath;
    this.docName =
      this.url.href.split('://')[1].replace(/[^0-9a-z]/gim, '-') + '.html';
    this.docFilename = path.join(this.filePath, this.docName);
    this.filesDirName = path.join(
      this.filePath,
      path.basename(this.docName, '.html') + '_files'
    );
  }

  loadImages(pageData, timeout = 3000) {
    const $ = cheerio.load(pageData);
    return (
      fs
        .mkdir(this.filesDirName)
        // Skip not dir exist error
        .catch(() => {})
        .then(() => {
          let promises = [];

          $('img').each((i, image) => {
            const attrSrc = $(image).attr('src');
            const validSrc = makeValidURLFromSrc(attrSrc, this.url);
            const imageTopDomain = getTopDomainName(validSrc.hostname);

            if (imageTopDomain === this.topDomain) {
              const promise = new Promise((resolve, reject) => {
                
                console.log(`Downloading ${validSrc}...`);

                axios({
                  method: 'get',
                  url: validSrc.toString(),
                  responseType: 'stream',
                  timeout: timeout,
                })
                  .then((response) => {
                    const { absFilename } = makeLocalFilename(
                      validSrc,
                      this.filesDirName
                    );
                    resolve(fs.writeFile(absFilename, response.data, 'binary'));
                  })
                  .catch((err) => {
                    reject(err);
                  });
              });

              promises = [...promises, promise];
            } else {
              console.log('Skipped external URL', validSrc.href);
            }
          });

          return Promise.all(promises);
        })
    );
  }

  patch(pageData) {
    const $ = cheerio.load(pageData);

    $('img').each((i, image) => {
      const src = makeValidURLFromSrc($(image).attr('src'), this.url);
      const { relFilename } = makeLocalFilename(src, this.filesDirName);
      $(image).attr('src', relFilename);
    });

    return $.html();
  }

  loadPage() {
    const fileName = path.join(this.filePath, this.docName);

    return axios.get(this.url).then(({ data }) => {
      // Images are loaded asynchronously with the page (!)
      const patchedData = this.patch(data);
      // return this.loadImages(data).then(() => {
        return fs
          .writeFile(fileName, patchedData, 'utf-8')
          .then(() => ({ fileName, data }));
      // });
    });
  }
}
