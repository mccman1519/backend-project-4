/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */

import nock from 'nock';
import path from 'path';
import os from 'os';
import { cwd } from 'process';
import { fileURLToPath } from 'url';
import * as fs from 'node:fs/promises';
import { pageLoader } from '../src/index.js';
import { makeLocalFilename } from '../src/utils.js';
import { constants } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (name) => path.join(__dirname, '..', '__fixtures__', name);

const testUrl = new URL('https://test-url.com');

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

test('Load page', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .reply(200, 'A normal reply 200');
  await expect((await pageLoader(testUrl.origin, tmpDir)).data).toEqual('A normal reply 200');
});

test('Generate valid filename', async () => {
  nock(testUrl.origin)
    .get(testUrl.pathname)
    .reply(200);
  await expect((await pageLoader(testUrl.origin, tmpDir)).docFileName).toEqual(`${tmpDir}/test-url-com-.html`);
});
