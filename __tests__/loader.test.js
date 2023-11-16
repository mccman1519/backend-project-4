/* eslint-disable no-undef */
import nock from 'nock';
import path from 'path';
import { cwd } from 'process';
import { fileURLToPath } from 'url';
import * as fs from 'node:fs/promises';
import PageLoader from '../src/loader.js';
import { makeLocalFilename } from '../src/utils.js';
import { constants } from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (name) => path.join(__dirname, '..', '__fixtures__', name);

const docName = 'ru-hexlet-io-courses.html';
const filesDir = 'ru-hexlet-io-courses_files';

const rawHtml = await fs.readFile(getFixturePath('raw.html'), 'utf-8');
const expectedHtml = await fs.readFile(getFixturePath('expected.html'));

const pageUrl = new URL('https://ru.hexlet.io/courses');
const imageURL = new URL('https://ru.hexlet.io/assets/professions/nodejs.png');
const cssURL = new URL('https://ru.hexlet.io/assets/application.css');
const jsURL = new URL('https://ru.hexlet.io/packs/js/runtime.js');

let tmpDir;
let specOutput;

nock.disableNetConnect();

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  process.chdir(tmpDir);
  specOutput = await fs.mkdtemp(path.join(tmpDir, 'spec-'));
});

afterEach(async () => {
  process.chdir(cwd());
  await fs.rmdir(tmpDir, { recursive: true });
});

test('Behavior with invalid URL', async () => {
  await expect(() => new PageLoader('invalid.com')).toThrow(
    'Invalid URL'
  );
});

test('If loadPage() make a request', async () => {
  const scope = nock(pageUrl.origin).get(pageUrl.pathname).reply(200);
  await (new PageLoader(pageUrl.href, tmpDir).loadPage());
  expect(scope.isDone()).toBe(true);
});

test('If loadPage() returns a valid filename', async () => {
  nock(pageUrl.origin).get(pageUrl.pathname).reply(200, '<html></html>');
  let resultFileName;
  await new PageLoader(pageUrl.href, tmpDir).loadPage()
    .then(({fileName}) => resultFileName = fileName)

  expect(resultFileName).toEqual(path.join(tmpDir, docName));
});

describe('If loaded document exists in file system', () => {
  test('With default path', async () => {
    nock(pageUrl.origin).get(pageUrl.pathname).reply(200, rawHtml, {
        'Content-Type': 'text/html; charset=utf-8',
      });
    await new PageLoader(pageUrl.href, tmpDir).loadPage();
    const fileNameDef = path.join(tmpDir, docName);
    expect(await fs.access(fileNameDef, constants.R_OK | constants.W_OK)).toBeUndefined();
  });

  test('With specified filename', async () => {
    nock(pageUrl.origin).get(pageUrl.pathname).reply(200, rawHtml, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    await new PageLoader(pageUrl.href, specOutput).loadPage();
    const fileNameSpec = path.join(specOutput, docName);
    expect(await fs.access(fileNameSpec, constants.R_OK | constants.W_OK)).toBeUndefined();
  });
});

describe('Check images and directories', () => {
  test('Image was loaded into the dir', async () => {
    nock(pageUrl.origin)
      .get(imageURL.pathname)
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });
    const { absFilename: imageFileName } = makeLocalFilename(imageURL, path.join(tmpDir, filesDir));     
    await new PageLoader(pageUrl.href, tmpDir).load('img', rawHtml);
    expect(await fs.access(imageFileName, constants.R_OK | constants.W_OK)).toBeUndefined();   
  });
});

describe('Check resources and HTML changes', () => {
  test('LINK tag resource download', async () => {
    nock(pageUrl.origin)
      .get(cssURL.pathname)
      .replyWithFile(200, getFixturePath('mock.css'), {
        'Content-Type': 'text/css; charset=utf-8',
      })
      .get(pageUrl.pathname) // Проверить скачку всех ресурсов, в т.ч. .html
      .reply(200, rawHtml, {
        'Content-Type': 'text/html; charset=utf-8',
      })
    const { absFilename: cssFileName } = makeLocalFilename(cssURL, path.join(tmpDir, filesDir));     
    const { absFilename: htmlFileName } = makeLocalFilename(pageUrl, path.join(tmpDir, filesDir));
    await new PageLoader(pageUrl.href, tmpDir).load('link', rawHtml);
    expect(await fs.access(cssFileName, constants.R_OK | constants.W_OK)).toBeUndefined();
    expect(await fs.access(`${htmlFileName}.html`, constants.R_OK | constants.W_OK)).toBeUndefined();
  });

  test('SCRIPT tag resource download', async () => {
    nock(pageUrl.origin)
      .get(jsURL.pathname)
      .reply(200, 'this is js script', {
        'Content-Type': 'text/javascript; charset=utf-8',
      });

    const { absFilename: jsFileName } = makeLocalFilename(jsURL, path.join(tmpDir, filesDir));
    await new PageLoader(pageUrl.href, tmpDir).load('script', rawHtml);
    expect(await fs.access(jsFileName, constants.R_OK | constants.W_OK)).toBeUndefined();
  });

  test('Check loaded HTML patching', async () => {
    nock(pageUrl.origin).get(pageUrl.pathname).reply(200, rawHtml, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    const { data: loadedHtml } = await new PageLoader(pageUrl.href, tmpDir).loadPage();
    expect(loadedHtml).toEqual(rawHtml);
  });
});