#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { loadSsgCatalogs } = require('../i18n/babel-inline-plugin');
const { runProjectionCli } = require('./lib/questWebProjectionCli');
const { parseCliArgs, runCli } = require('./lib/cli-contract');

const CLI_SPEC = { name: 'build-quest-web-projection', usage: 'node scripts/build-quest-web-projection.js < private-snapshot.json', flags: {}, selection: 'none' };

if (require.main === module) {
  runCli(() => {
    parseCliArgs(process.argv, CLI_SPEC);
    const { catalogs } = loadSsgCatalogs(path.resolve(__dirname, '..'));
    return runProjectionCli(catalogs);
  }, CLI_SPEC);
}
