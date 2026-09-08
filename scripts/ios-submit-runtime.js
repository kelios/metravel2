#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const IOS_SUBMIT_CONFIG_FILES = Object.freeze([
  'app.json',
  'app.config.js',
  'eas.json',
  'package.json',
  'yarn.lock',
  'scripts/android-firebase-config.js',
]);
const IOS_SUBMIT_PROJECT_DIRECTORIES = Object.freeze([
  'node_modules',
  'plugins',
  'assets',
  'ios',
]);

function prepareIosSubmitConfigRuntime(projectRoot, runtimeRoot) {
  for (const relativePath of IOS_SUBMIT_CONFIG_FILES) {
    const sourcePath = path.join(projectRoot, relativePath);
    const runtimePath = path.join(runtimeRoot, relativePath);
    fs.mkdirSync(path.dirname(runtimePath), { recursive: true, mode: 0o700 });
    fs.copyFileSync(sourcePath, runtimePath);
  }
}

function prepareIosSubmitRuntime(projectRoot, runtimeRoot) {
  prepareIosSubmitConfigRuntime(projectRoot, runtimeRoot);
  for (const relativePath of IOS_SUBMIT_PROJECT_DIRECTORIES) {
    fs.symlinkSync(
      path.join(projectRoot, relativePath),
      path.join(runtimeRoot, relativePath),
      'dir',
    );
  }
}

function resolveIosSubmitConfigRuntime(runtimeRoot) {
  const configure = require(path.join(runtimeRoot, 'app.config.js'));
  if (typeof configure !== 'function') {
    throw new Error('app.config.js must export a configuration function');
  }
  const app = JSON.parse(
    fs.readFileSync(path.join(runtimeRoot, 'app.json'), 'utf8'),
  ).expo;
  return configure({ config: app });
}

if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'prepare' && args.length === 2) {
    prepareIosSubmitRuntime(args[0], args[1]);
  } else if (command === 'validate' && args.length === 1) {
    resolveIosSubmitConfigRuntime(args[0]);
  } else {
    console.error(
      'Usage: ios-submit-runtime.js prepare PROJECT_ROOT RUNTIME_ROOT | validate RUNTIME_ROOT',
    );
    process.exit(2);
  }
}

module.exports = {
  IOS_SUBMIT_CONFIG_FILES,
  IOS_SUBMIT_PROJECT_DIRECTORIES,
  prepareIosSubmitConfigRuntime,
  prepareIosSubmitRuntime,
  resolveIosSubmitConfigRuntime,
};
