#!/usr/bin/env node

const { validateStoreListing } = require('./ios-store-listing-guard-lib');

const args = process.argv.slice(2);
const screenshotsIndex = args.indexOf('--screenshots');
const screenshotsDir = screenshotsIndex >= 0 ? args[screenshotsIndex + 1] : undefined;

if (screenshotsIndex >= 0 && !screenshotsDir) {
  console.error('--screenshots требует путь к каталогу PNG');
  process.exitCode = 1;
} else {
  const errors = validateStoreListing(process.cwd(), { screenshotsDir });
  if (errors.length) {
    console.error('App Store listing FAILED:');
    for (const error of errors) console.error(`- ${error.code}: ${error.detail}`);
    process.exitCode = 1;
  } else {
    console.log(
      screenshotsDir
        ? `App Store listing OK (включая скриншоты ${screenshotsDir})`
        : 'App Store listing OK (без проверки скриншотов: передайте --screenshots <dir>)',
    );
  }
}
