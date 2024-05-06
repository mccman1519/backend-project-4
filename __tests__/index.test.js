/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */

import nock from 'nock';
import path from 'path';
import os from 'os';
// import { cwd } from 'process';
import { fileURLToPath } from 'url';
import * as fs from 'node:fs/promises';
import { constants } from 'fs';
import pageLoader from '../src/loader.js';
import { makeLocalFilename } from '../src/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (name) => path.join(__dirname, '..', '__fixtures__', name);

const testUrl = new URL('https://test-url.com');
const imageURL = new URL('https://test-url.com/assets/professions/nodejs.png');
const scriptURL = new URL('https://test-url.com/packs/js/runtime.js');
const cssURL = new URL('https://test-url.com/assets/application.css');
const htmlFileName = 'input.html';
const imageFileName = 'nodejs.png';
const filesDir = 'test-url-com-_files';

let tmpDir;
let specOutput;

beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  process.chdir(tmpDir);
  specOutput = await fs.mkdtemp(path.join(tmpDir, 'spec-'));
});

afterEach(async () => {
  process.chdir(os.tmpdir());
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.rm(specOutput, { recursive: true, force: true });
});

test('Throws on bad URL', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .replyWithError('getaddrinfo ENOTFOUND');
  await expect(pageLoader(testUrl.origin, tmpDir)).rejects.toThrow();
});

test('Rejects on non-200', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .reply(500, 'Not normal reply 200');
  await expect(pageLoader(testUrl.origin, tmpDir)).rejects.toThrow();
});

test('Load page', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .reply(200, 'A normal reply 200');
  await expect((await pageLoader(testUrl.origin, tmpDir)).rawHtmlData).toEqual('A normal reply 200');
});

test('Generate valid filename', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .reply(200);
  await expect((await pageLoader(testUrl.origin, tmpDir)).docFilename).toEqual(`${tmpDir}/test-url-com-.html`);
});

test('Transform HTML', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .replyWithFile(200, getFixturePath(htmlFileName), {
      'Content-Type': 'text/html; charset=utf-8',
    });
  const { docFilename } = await pageLoader(testUrl.origin, tmpDir);
  const expectedHtml = await fs.readFile(getFixturePath('expected.html'), 'utf-8');
  const actualHtml = await fs.readFile(docFilename, 'utf-8');

  await expect(actualHtml).toEqual(expectedHtml);
});

test('Check images was downloaded', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .replyWithFile(200, getFixturePath(htmlFileName), {
      'Content-Type': 'text/html; charset=utf-8',
    })
    .get(imageURL.pathname)
    .replyWithFile(200, getFixturePath(imageFileName), {
      'Content-Type': 'image/png',
    });

  const { absFilename } = makeLocalFilename(imageURL, filesDir);
  await pageLoader(testUrl.origin, tmpDir);
  expect(await fs.access(absFilename, constants.R_OK | constants.W_OK)).toBeUndefined();
});

test('Check script resources was downloaded', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .replyWithFile(200, getFixturePath(htmlFileName), {
      'Content-Type': 'text/html; charset=utf-8',
    })
    .get(scriptURL.pathname)
    .reply(200, 'this is js script file', {
      'Content-Type': 'text/javascript; charset=utf-8',
    });

  const { absFilename } = makeLocalFilename(scriptURL, filesDir);
  await pageLoader(testUrl.origin, tmpDir);
  expect(await fs.access(absFilename, constants.R_OK | constants.W_OK)).toBeUndefined();
});

test('Check css resources was downloaded', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .replyWithFile(200, getFixturePath(htmlFileName), {
      'Content-Type': 'text/html; charset=utf-8',
    })
    .get(cssURL.pathname)
    .reply(200, 'this is css file', {
      'Content-Type': 'text/css; charset=utf-8',
    });

  const { absFilename } = makeLocalFilename(cssURL, filesDir);
  await pageLoader(testUrl.origin, tmpDir);
  expect(await fs.access(absFilename, constants.R_OK | constants.W_OK)).toBeUndefined();
});

test('Throws on write file error', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .reply(200, 'A normal reply 200');
  fs.chmod(tmpDir, 0o444);
  await expect(pageLoader(testUrl.origin, tmpDir)).rejects.toThrow();
  fs.chmod(tmpDir, 0o777);
});
