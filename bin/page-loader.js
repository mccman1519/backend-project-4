#!/usr/bin/env node

/* eslint-disable indent */

import debug from 'debug';
import { Command } from "commander";
import path from "path";
import { cwd } from "process";
import PageLoader from "../src/loader.js";
import process from 'process';

const errorLog = debug('page-loader:error');

const program = new Command();
const defaultOutput = path.resolve(cwd());

program
  .description('Downloads web-page with all its resourses')
  .version('1.0.0')
  .option('-o, --output <dir>', 'output dir', `${defaultOutput}`)
  .option('-d --debug', 'enables debug logger')
  .argument('<url>')
  .action(async (url) => {
    const outputPath = path.resolve(program.opts().output) ?? defaultOutput;
    const loader = new PageLoader(url, outputPath);

    if (program.opts().debug) {
      // console.dir({...debug});
      
      debug.enable('page-loader*,axios');
      
    }

    loader
      .loadPage()
      .then(({ fileName, data }) => {
        return Promise.all([
          loader.load('img', data)/* .catch((err) => console.error(err)) */,
          loader.load('link', data)/* .catch((err) => console.error(err)) */,
          loader.load('script', data)/* .catch((err) => console.error(err)) */,
        ])
        .catch(err => errorLog(err))
        .then(() => fileName) // Passthrough fileName when everything is done
      })
      .then((fileName) =>
        console.log(`Page successfuly downloaded into ${fileName}`)
      )
      .catch((err) => {
        console.log(err.message);
        process.exit(1);
      })
  });

program.parse();
