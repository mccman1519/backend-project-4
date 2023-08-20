/* eslint-disable no-undef */
import nock from 'nock';
import mock from 'mock-fs';
import path from 'path';
import { cwd } from 'process';
import * as fs from 'node:fs/promises';
import PageLoader from '../src/loader.js';
import { constants } from 'fs';

nock.disableNetConnect();

const rawUrl = 'https://www.github.com/nock/nock';
const docName = 'www-github-com-nock-nock.html';
const filePath = '/home/collider/repos/hexlet/backend-project-4/out';
const defaultOutput = path.resolve(cwd());

const url = new URL(rawUrl);
const loader = new PageLoader();

let scope;

beforeEach(() => {
  scope = nock(url.origin).get(url.pathname).reply(200, '<html></html>');
});

test('If loadPage() make a request', async () => {
  await loader.loadPage(rawUrl);
  expect(scope.isDone()).toBe(true);
});

test('If save() returns a valid filename', async () => {
  let fileName;
  await loader.loadPage(rawUrl)
    .then(() => loader.save(filePath))
    .then((resultFileName) => fileName = resultFileName);

  expect(fileName).toEqual(path.join(filePath, docName));
});

describe('If loaded document exists in file system', () => {
  beforeEach(function() {
    mock({
      [filePath]: {
        'fixture.html': '<html></html>',
      },
      [defaultOutput]: {
        // empty
      },
    });
  });

  afterEach(mock.restore);

  test('With default path', async () => {
    await loader.loadPage(rawUrl).then(() => loader.save(defaultOutput));
    const fileNameDef = path.join(defaultOutput, docName);
    expect(await fs.access(fileNameDef, constants.R_OK | constants.W_OK)).toBeUndefined();
  });

  test('With specified filename', async () => {
    await loader.loadPage(rawUrl).then(() => loader.save(filePath));
    const fileNameSpec = path.join(filePath, docName);
    expect(await fs.access(fileNameSpec, constants.R_OK | constants.W_OK)).toBeUndefined();
  });
});

test('Behavior with invalid URL', async () => {
  await expect(() => loader.loadPage('invalid.com')).rejects.toThrow(
    'Invalid URL'
  );
});
