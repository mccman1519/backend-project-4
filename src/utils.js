import path from 'node:path';

const isValidHttpUrl = (string) => {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
};

/**
 * @param {*} hostname
 * @returns String `<domain>.<zone>`
 */
const getTopDomainName = (hostname) => {
  const parts = hostname.split('.');
  return `${parts.at(-2)}.${parts.at(-1)}`;
};

/**
 *
 * @param {URL} src An URL instance
 * @param {string} filesDirName Local "_files" directory name
 * @returns {{ absFilename: string, relFilename: string }}
 * Object with absolute and relative filenames
 */
const makeLocalFilename = (src, filesDirName) => {
  const ext = path.extname(src.pathname);
  const basename = path.basename(src.pathname, ext);
  const dirname = path.dirname(src.pathname);
  const imageFN = path.join(src.hostname, dirname, basename).replace(/[^0-9a-z]/gim, '-') + ext;

  return {
    absFilename: path.join(filesDirName, imageFN),
    relFilename: path.join(path.basename(filesDirName), imageFN),
  };
};

/**
 *
 * @param {*} src A value of src attribute
 * @param {URL} pageURL Page URL
 * @returns {URL} A valid URL of the resource
 */
const makeValidURLFromSrc = (src, pageURL) => {
  if (!isValidHttpUrl(src)) {
    // fix URL
    // console.log(this.url.origin, src);
    return new URL(src || '', pageURL.origin);
  }

  return new URL(src);
};

export {
  isValidHttpUrl,
  getTopDomainName,
  makeLocalFilename,
  makeValidURLFromSrc,
};
