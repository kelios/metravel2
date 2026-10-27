#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadSsgCatalogs } = require('../i18n/babel-inline-plugin');
const { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES } = require('./lib/questWebProjectionCli');
const { parseCliArgs, runCli } = require('./lib/cli-contract');

const CLI_SPEC = { name: 'package-quest-web-builder', usage: 'node scripts/package-quest-web-builder.js --output-dir <runtime-dir>',
  flags: { 'output-dir': { type: 'string', required: true } }, selection: 'none' };

/** Pin public-page code and all five immutable catalogues; never include content. */
async function packageQuestWebBuilder(runtimeDir, { root = path.resolve(__dirname, '..') } = {}) {
  const { build } = require('esbuild');
  const { catalogs } = loadSsgCatalogs(root);
  const serialized = JSON.stringify([...catalogs].map(([locale, rows]) => [locale, [...rows]]));
  const output = path.resolve(runtimeDir);
  fs.mkdirSync(output, { recursive: true });
  const builderPath = path.join(output, 'quest-web-builder.cjs');
  await build({
    stdin: { contents: `const {runProjectionCli}=require('./scripts/lib/questWebProjectionCli');\nconst {parseCliArgs,runCli}=require('./scripts/lib/cli-contract');\nconst spec={name:'quest-web-builder',usage:'node quest-web-builder.cjs < private-snapshot.json',flags:{},selection:'none'};\nrunCli(()=>{parseCliArgs(process.argv,spec);const catalogs=new Map(${serialized}.map(([locale,rows])=>[locale,new Map(rows)]));return runProjectionCli(catalogs);},spec);`,
      resolveDir: root, sourcefile: 'quest-web-builder-entry.cjs', loader: 'js' },
    outfile: builderPath, bundle: true, platform: 'node', target: 'node22', format: 'cjs', logLevel: 'silent',
  });
  const receipt = { schema_version: 2, sha256: createHash('sha256').update(fs.readFileSync(builderPath)).digest('hex'),
    max_input_bytes: MAX_INPUT_BYTES, max_output_bytes: MAX_OUTPUT_BYTES };
  fs.writeFileSync(path.join(output, '.quest-web-builder.json'), JSON.stringify(receipt) + '\n');
  return receipt;
}

module.exports = { packageQuestWebBuilder };
if (require.main === module) {
  runCli(() => {
    const args = parseCliArgs(process.argv, CLI_SPEC);
    return packageQuestWebBuilder(args.outputDir);
  }, CLI_SPEC);
}
