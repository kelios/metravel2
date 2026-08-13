#!/usr/bin/env node

const { inspectIosEnvironment } = require('./ios-environment-preflight-lib');

const result = inspectIosEnvironment();
if (result.errors.length > 0) {
  console.error('iOS environment preflight FAILED:');
  for (const error of result.errors) {
    console.error(`- ${error.code}: ${error.detail}`);
  }
  process.exitCode = 1;
} else {
  const runtime = result.matchingRuntimes[0];
  console.log('iOS environment preflight OK');
  console.log(`- Xcode: ${result.xcodeVersion.replace(/\n/g, ', ')}`);
  console.log(`- SDK/runtime: ${result.sdkVersion} / ${runtime.version} (${runtime.buildversion})`);
  console.log(`- eligible iPhone simulators: ${result.destinations.length}`);
}
