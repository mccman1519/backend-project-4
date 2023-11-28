import debug from 'debug';
import FileSystemError from './FileSystemError.js';
import NetworkError from './NetworkError.js';

const log = debug('page-loader');

export const NETWORK_ERROR_MESSAGES = {
  404: 'Not found',
  500: 'Internal Server Error',
};

export const FILESYSTEM_ERROR_MESSAGES = {
  ENOENT: (directory) => `The directory ${directory} doesn't exist`,
  EACCES: (directory) => `The access to the directory ${directory} is denied`,
};

const fileSystemErrorHandler = (error, { directory }) => {
  const { code } = error;
  const message = FILESYSTEM_ERROR_MESSAGES[code](directory) || error.message;
  log(`File System Error! ${message}`);
  throw new FileSystemError(message);
};

const axiosErrorHandler = (error) => {
  const { status } = error.response;
  const message = NETWORK_ERROR_MESSAGES[status] || error.message;
  throw new NetworkError(message);
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