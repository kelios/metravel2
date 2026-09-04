#!/usr/bin/env node

const { validateIosRelease } = require('./ios-release-guard-lib');

const errors = validateIosRelease(process.cwd(), { checkLiveAasa: true });
if (errors.length) {
  console.error('iOS release configuration FAILED:');
  for (const error of errors) console.error(`- ${error.code}: ${error.detail}`);
  process.exitCode = 1;
} else {
  console.log('iOS release configuration OK');
}
