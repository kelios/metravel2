#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const { EXPECTED } = require('./ios-release-guard-lib');

const EAS_BUILD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateEasBuildMetadata(metadata, buildId, currentRevision) {
  if (!EAS_BUILD_ID_PATTERN.test(buildId) ||
      metadata.id !== buildId ||
      metadata.status !== 'FINISHED' ||
      metadata.platform !== 'IOS' ||
      metadata.distribution !== 'STORE' ||
      metadata.buildProfile !== 'production' ||
      metadata.appVersion !== EXPECTED.version ||
      metadata.appBuildVersion !== EXPECTED.buildNumber ||
      metadata.gitCommitHash !== currentRevision) {
    throw new Error('EAS build metadata does not match the exact current production release candidate');
  }
  let artifactUrl;
  try {
    artifactUrl = new URL(metadata.artifacts?.buildUrl);
  } catch {
    throw new Error('EAS build metadata does not contain a protected HTTPS IPA artifact URL');
  }
  if (artifactUrl.protocol !== 'https:') {
    throw new Error('EAS build metadata does not contain a protected HTTPS IPA artifact URL');
  }
  return artifactUrl.href;
}

async function fetchHttpsArtifact(artifactUrl, fetchImplementation = fetch, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error('EAS artifact download exceeded the HTTPS redirect limit');
  }
  const currentUrl = new URL(artifactUrl);
  if (currentUrl.protocol !== 'https:') {
    throw new Error('EAS artifact redirect must remain on HTTPS');
  }
  const response = await fetchImplementation(currentUrl.href, { redirect: 'manual' });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) {
      if (response.body) await response.body.cancel();
      throw new Error('EAS artifact redirect is missing a location');
    }
    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.protocol !== 'https:') {
      if (response.body) await response.body.cancel();
      throw new Error('EAS artifact redirect must remain on HTTPS');
    }
    if (response.body) await response.body.cancel();
    return fetchHttpsArtifact(nextUrl.href, fetchImplementation, redirectCount + 1);
  }
  return response;
}

async function main() {
  const [buildId, metadataPath, outputPath] = process.argv.slice(2);
  if (!buildId || !metadataPath || !outputPath) {
    throw new Error('Usage: ios-eas-artifact-download.js BUILD_ID METADATA_JSON OUTPUT_IPA');
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const currentRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  }).trim();
  const artifactUrl = validateEasBuildMetadata(metadata, buildId, currentRevision);
  const response = await fetchHttpsArtifact(artifactUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download the exact EAS IPA artifact (HTTP ${response.status})`);
  }
  const partialPath = `${outputPath}.partial`;
  if (fs.existsSync(outputPath) || fs.existsSync(partialPath)) {
    throw new Error('Refusing to overwrite an existing local iOS artifact path');
  }
  let partialCreated = false;
  try {
    const partialFile = fs.openSync(partialPath, 'wx', 0o600);
    partialCreated = true;
    const destination = fs.createWriteStream(partialPath, { fd: partialFile });
    await finished(Readable.fromWeb(response.body).pipe(destination));
    fs.renameSync(partialPath, outputPath);
  } catch (error) {
    if (partialCreated) fs.rmSync(partialPath, { force: true });
    throw error;
  }
  console.log('Exact EAS production artifact downloaded for local pre-upload audit');
}

if (require.main === module) {
  main().catch(error => {
    console.error(`iOS EAS artifact download FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  EAS_BUILD_ID_PATTERN,
  fetchHttpsArtifact,
  validateEasBuildMetadata,
};
