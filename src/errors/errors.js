import debug from 'debug';
import FileSystemError from './FileSystemError.js';
import NetworkError from './NetworkError.js';
import { basename, dirname } from 'path';

const log = debug('page-loader:error');

export const NETWORK_ERROR_MESSAGES = {
  404: 'Not found',
  500: 'Internal Server Error',
};

export const FILESYSTEM_ERROR_MESSAGES = {
  ENOENT: (directory) => `The directory ${directory} doesn't exist`,
  EACCES: (directory) => `Access to the directory ${directory} is denied`,
};

const fileSystemErrorHandler = (error) => {
  const { code, path } = error;
  const message = FILESYSTEM_ERROR_MESSAGES[code](dirname(path)) || error.message;
  log(`File System Error! ${message}`);
  throw new FileSystemError(message);
};

const axiosErrorHandler = (error) => {
  const { status } = error.response ?? -1;  
  const message = NETWORK_ERROR_MESSAGES[status] || error.message;
  log(`An error while loading '${basename(error.config.url)}': ${message}`);
  throw new NetworkError(`An error while loading '${basename(error.config.url)}': ${message}`);
};

export const errorHandler = (error, data) => {
  if (error instanceof FileSystemError || error instanceof NetworkError) {
    throw error;
  }
  if (error.name === 'AxiosError') {
    axiosErrorHandler(error);
  } else {
    fileSystemErrorHandler(error, data);
  }
};