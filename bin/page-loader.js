#!/usr/bin/env node
/* eslint-disable no-console */

import logger from 'debug';
import { Command } from 'commander';
import path from 'path';
import { cwd } from 'process';
import pageLoader from '../src/loader.js';

const program = new Command();
const defaultOutput = path.resolve(cwd());
const debug = logger('page-loader');

program
  .description('Downloads web-page with all its resourses')
  .version('1.0.0')
  .option('-o, --output <dir>', 'output dir', `${defaultOutput}`)
  .option('-d --debug', 'enables debug logger')
  .argument('<url>')
  .action(async (url) => {
    const outputPath = path.resolve(program.opts().output) ?? defaultOutput;
    try {
      // Test it with:
      // https://udaff.com/view_listen/photo/random.html
      const plResult = await pageLoader(url, outputPath);

      if (program.opts().debug) {
        // console.dir({...debug});
        // debug.enable('page-loader*,axios');
      }

      debug(`Status: ${plResult.status}`);
      // console.log(`Data:\n${plResult.data}`);
      console.log('See in', plResult.docFilename);
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

program.parse();
