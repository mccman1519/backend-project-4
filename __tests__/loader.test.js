/* eslint-disable no-undef */
import nock from "nock";
import path from "path";
import { cwd } from "process";
import { fileURLToPath } from "url";
import * as fs from "node:fs/promises";
import PageLoader from "../src/loader.js";
import { constants } from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (name) =>
  path.join(__dirname, "..", "__fixtures__", name);

const docName = "ru-hexlet-io-courses.html";
const filePath = "/home/collider/repos/hexlet/backend-project-4/out";
const filesDir = "ru-hexlet-io-courses_files";
const defaultOutput = path.resolve(cwd());
const filesDirName = path.join(filePath, filesDir);
const pngName = "nodejs.png";
const imageFilename = path.join(filesDirName, pngName);

const rawHtml = await fs.readFile(getFixturePath("raw.html"));
const expectedHtml = await fs.readFile(getFixturePath("expected.html"));
const imagePng = await fs.readFile("__fixtures__/nodejs.png", "binary");

const pageUrl = new URL("https://ru.hexlet.io/courses");
const imageURL = new URL("https://ru.hexlet.io/assets/professions/nodejs.png");

let tmpDir;
let currFilesDir;
let specOutput;
let currNestedFilesDir;

nock.disableNetConnect();

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-"));
  process.chdir(tmpDir);
  currFilesDir = path.join(cwd(), filesDir);
  specOutput = await fs.mkdtemp(path.join(tmpDir, "spec-"));
  currNestedFilesDir = path.join(specOutput, filesDir);
});

afterEach(async () => {
  process.chdir(cwd());
  await fs.rmdir(tmpDir, { recursive: true });
});

test("Behavior with invalid URL", async () => {
  await expect(() => new PageLoader("invalid.com")).toThrow("Invalid URL");
});

test("If loadPage() make a request", async () => {
  const scope = nock(pageUrl.origin).get(pageUrl.pathname).reply(200);
  await new PageLoader(pageUrl.href, filePath).loadPage();
  expect(scope.isDone()).toBe(true);
});

test("If loadPage() returns a valid filename", async () => {
  nock(pageUrl.origin).get(pageUrl.pathname).reply(200, "<html></html>");
  let resultFileName;
  await new PageLoader(pageUrl.href, filePath)
    .loadPage()
    .then(({ fileName }) => (resultFileName = fileName));

  expect(resultFileName).toEqual(path.join(filePath, docName));
});

describe("If loaded document exists in file system", () => {
  test("With default path", async () => {
    nock(pageUrl.origin).get(pageUrl.pathname).reply(200, rawHtml);
    await new PageLoader(pageUrl.href, defaultOutput).loadPage();
    const fileNameDef = path.join(defaultOutput, docName);
    expect(
      await fs.access(fileNameDef, constants.R_OK | constants.W_OK)
    ).toBeUndefined();
  });

  test("With specified filename", async () => {
    nock(pageUrl.origin).get(pageUrl.pathname).reply(200, rawHtml);
    await new PageLoader(pageUrl.href, specOutput).loadPage();
    const fileNameSpec = path.join(specOutput, docName);
    expect(
      await fs.access(fileNameSpec, constants.R_OK | constants.W_OK)
    ).toBeUndefined();
  });
});

describe("Check images and directories", () => {
  test("[UNNECESSARY] Image dir was created", async () => {
    nock(pageUrl.origin).get(pageUrl.pathname).reply(200, rawHtml);
    await new PageLoader(pageUrl.href, filePath).loadPage();
    expect(
      await fs.access(filesDirName, constants.R_OK | constants.W_OK)
    ).toBeUndefined();
  });

  test('Image was loaded into the dir', async () => {
    nock(pageUrl.origin)
      .persist()
      .get(imageURL.pathname)
      .replyWithFile(200, getFixturePath('nodejs.png'));
    await new PageLoader(pageUrl.href, tmpDir).loadImages(rawHtml);

    expect(
      await fs.access(
        path.join(currFilesDir, 'ru-hexlet-io-assets-professions-nodejs.png'),
        constants.R_OK | constants.W_OK
      )
    ).toBeUndefined();
  });

  test.skip("Correct link in html", () => {
    // Get link from loaded html and compare with <relativePath + pngName>
    return false;
  });
});
