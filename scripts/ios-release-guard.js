#!/usr/bin/env node

const { validateIosRelease } = require('./ios-release-guard-lib');

// `--skip-live-aasa` keeps the run on the source tree: a commit gate
// (check:fast, check:preflight) must not depend on the network, on production
// state or on Xcode. Build, prebuild and submit run the guard without the flag.
const checkLiveAasa = !process.argv.includes('--skip-live-aasa');
const errors = validateIosRelease(process.cwd(), { checkLiveAasa });
if (errors.length) {
  console.error('iOS release configuration FAILED:');
  for (const error of errors) console.error(`- ${error.code}: ${error.detail}`);
  process.exitCode = 1;
} else {
  console.log('iOS release configuration OK');
}
