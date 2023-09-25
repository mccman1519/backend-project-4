import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "node:fs/promises";
// import { constants } from 'node:fs';
import path from "node:path";

const isValidHttpUrl = (string) => {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
};

const getTopDomainName = (hostname) => {
  const parts = hostname.split(".");
  return `${parts.at(-2)}.${parts.at(-1)}`;
};

/**
 *
 * @param {URL} src An URL instance
 * @param {string} filesDirName Local "_files" directory name
 * @returns {{ absFilename: string, relFilename: string }}  Object with absolute and relative filenames
 */
const makeLocalFilename = (src, filesDirName) => {
  const ext = path.extname(src.pathname);
  const basename = path.basename(src.pathname, ext);
  const dirname = path.dirname(src.pathname);
  const imageFN =
    path.join(src.hostname, dirname, basename).replace(/[^0-9a-z]/gim, "-") +
    ext;

  return {
    absFilename: path.join(filesDirName, imageFN),
    relFilename: path.join(path.basename(filesDirName), imageFN),
  };
};

/**
 *
 * @param {*} src A value of src attribute
 * @param {*} pageURL Page URL
 * @returns {URL} A valid URL of the resource
 */
const makeValidURLFromSrc = (src, pageURL) => {
  if (!isValidHttpUrl(src)) {
    // fix URL
    //console.log(this.url.origin, src);
    return new URL(src, pageURL.origin);
  } else {
    return new URL(src);
  }
};

export default class PageLoader {
  constructor(url, filePath) {
    if (!isValidHttpUrl(url)) {
      throw new TypeError("Invalid URL (maybe forget protocol?)");
    }

    this.url = new URL(url);
    this.topDomain = getTopDomainName(this.url.hostname);
    this.filePath = filePath;
    this.docName =
      this.url.href.split("://")[1].replace(/[^0-9a-z]/gim, "-") + ".html";
    this.docFilename = path.join(this.filePath, this.docName);
    this.filesDirName = path.join(
      this.filePath,
      path.basename(this.docName, ".html") + "_files"
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
          $("img").each((i, image) => {
            const attrSrc = $(image).attr("src");
            const validSrc = makeValidURLFromSrc(attrSrc, this.url);
            const imageTopDomain = getTopDomainName(validSrc.hostname);

            if (imageTopDomain === this.topDomain) {
              axios({
                method: "get",
                url: validSrc.toString(),
                responseType: "stream",
                timeout: timeout,
              })
                .then((response) => {
                  const { absFilename } = makeLocalFilename(
                    validSrc,
                    this.filesDirName
                  );
                  return fs.writeFile(absFilename, response.data, "binary");
                })
                .catch((err) => {
                  // Catching loading errors
                  err;
                });
            } else {
              console.log("Skipped external URL", validSrc.href);
            }
          });
        })
    );
  }

  patch(pageData) {
    const $ = cheerio.load(pageData);

    $("img").each((i, image) => {
      const src = makeValidURLFromSrc($(image).attr("src"), this.url);
      const { relFilename } = makeLocalFilename(src, this.filesDirName);
      $(image).attr("src", relFilename);
    });

    return $.html();
  }

  loadPage() {
    const fileName = path.join(this.filePath, this.docName);

    return axios.get(this.url).then(({ data }) => {
      // Images are loaded asynchronously with the page (!)
      const patchedData = this.patch(data);
      return this.loadImages(data).then(() => {
        return fs
          .writeFile(fileName, patchedData, "utf-8")
          .then(() => ({ fileName, data }));
      });
    });
  }
}
