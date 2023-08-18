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

test('If loadPage() make a request', async () => {
  const scope = nock(url.origin).get(url.pathname).reply(200, 'Some html data');

  await loader.loadPage(rawUrl);
  expect(scope.isDone()).toBe(true);
});

test('If save() returns a valid filename', async () => {
  nock(url.origin).get(url.pathname).reply(200, 'Some html data');

  // const fileName = loader.loadPage(rawUrl).save(filePath);
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
        // [docName]: '<html></html>',
      },
      //'path/to/some.png': Buffer.from([8, 6, 7, 5, 3, 0, 9]),
      [defaultOutput]: {
        // empty
      },
    });
  });

  afterEach(mock.restore);

  test('Default name', async () => {
    nock(url.origin).get(url.pathname).reply(200, '<html></html>');
  
    await loader.loadPage(rawUrl).then(() => loader.save(defaultOutput));
  
    const fileNameDef = path.join(defaultOutput, docName);
    // const contentDef = await fs.readFile(fileNameDef, 'utf-8');
  
    expect(await fs.access(fileNameDef, constants.R_OK | constants.W_OK)).toBeUndefined();
  });

  test('Specified filename', async () => {
    nock(url.origin).get(url.pathname).reply(200, '<html></html>');
  
    await loader.loadPage(rawUrl).then(() => loader.save(filePath));
  
    const fileNameSpec = path.join(filePath, docName);
    // const contentSpec = await fs.readFile(fileNameSpec, 'utf-8');
  
    expect(await fs.access(fileNameSpec, constants.R_OK | constants.W_OK)).toBeUndefined();
  });
});
