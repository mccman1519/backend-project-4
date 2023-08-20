#!/usr/bin/env node
/* eslint-disable indent */
import { Command } from 'commander';
import path from 'path';
import { cwd } from 'process';
import PageLoader from '../src/loader.js';

const program = new Command();
const defaultOutput = path.resolve(cwd());

program
  .description('Compares two configuration files and shows a difference.')
  .version('1.0.0')
  .option('-o, --output <dir>', 'output dir', `${defaultOutput}`)
  .argument('<url>')
  // .argument('<filepath2>')
  .action((url) => {
    const outputPath = program.opts().output ?? defaultOutput;
    const loader = new PageLoader();

    loader.loadPage(url)
      .then(() => loader.save(outputPath))
      .then((resultFileName) => console.log(`Page successfuly downloaded into ${resultFileName}`))
      .catch((err) => console.log(err.message));
  });

program.parse();
