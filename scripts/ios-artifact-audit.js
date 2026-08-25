#!/usr/bin/env node

const path = require('path');
const { auditIosIpa } = require('./ios-artifact-audit-lib');

const ipaPath = process.argv[2];
if (!ipaPath) {
  console.error('Usage: node scripts/ios-artifact-audit.js PATH_TO_IPA');
  process.exit(2);
}

const errors = auditIosIpa(process.cwd(), path.resolve(ipaPath));
if (errors.length > 0) {
  console.error('iOS release artifact FAILED:');
  for (const error of errors) console.error(`- ${error.code}: ${error.detail}`);
  process.exit(1);
}

console.log('iOS release artifact OK');
