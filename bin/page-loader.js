#!/usr/bin/env node
/* eslint-disable indent */
import { Command } from "commander";
import path from "path";
import { cwd } from "process";
import PageLoader from "../src/loader.js";

const program = new Command();
const defaultOutput = path.resolve(cwd());

program
  .description('Compares two configuration files and shows a difference.')
  .version('1.0.0')
  .option('-o, --output <dir>', 'output dir', `${defaultOutput}`)
  .argument('<url>')
  // .argument('<filepath2>')
  .action(async (url) => {
    const outputPath = path.resolve(program.opts().output) ?? defaultOutput;
    const loader = new PageLoader(url, outputPath);

    loader
      .loadPage()
      .then(({ fileName, data }) => {
        return Promise.all([
          loader.load('img', data).catch((err) => console.log(err)),
          loader.load('link', data).catch((err) => console.log(err)),
          loader.load('script', data).catch((err) => console.log(err)),
        ])
        .catch(err => console.log(err))
        .then(() => fileName) // Passthrough fileName when everything is done
      })
      .then((fileName) =>
        console.log(`Page successfuly downloaded into ${fileName}\n`)
      )
      .catch((err) => console.log(err.message));

    /**
     * for tests only
     */
    /*
    const docName = url.split('://')[1].replace(/[^0-9a-z]/gim, '-') + '.html';
    const fileName = path.join(outputPath, docName);
    loader.loadPage(url).then(() => loader.loadImages(fileName));
    */
  });

program.parse();
