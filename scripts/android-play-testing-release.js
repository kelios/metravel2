#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const {
  acquireLock,
  assertTracksUnchanged,
  commitEdit,
  getAccessToken,
  loadServiceAccount,
  maxVersionCodeFromTracks,
  normalizeTrack,
  readAppContract,
  releaseLock,
  runStatus,
  setTrackRelease,
  snapshotTracks,
  uploadBundle,
  validateEdit,
  withTemporaryEdit,
} = require('./android-play-release')
const { resolveServiceAccountPath } = require('./android-release-secrets')

const TESTING_TRACKS = Object.freeze(['alpha', 'internal'])
const IMMUTABLE_TRACKS = Object.freeze(['production', 'beta'])

function fail(message) {
  throw new Error(message)
}

function parseTestingArgs(argv) {
  const [command = 'upload-testing', ...rest] = argv
  const options = {
    command,
    commit: false,
    aab: null,
    serviceAccount: resolveServiceAccountPath(),
  }

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index]
    if (value === '--commit') {
      options.commit = true
    } else if (value === '--aab') {
      const aab = rest[++index]
      if (!aab) fail('--aab requires a path')
      options.aab = aab
    } else if (value === '--service-account') {
      const serviceAccount = rest[++index]
      if (!serviceAccount) fail('--service-account requires a path')
      options.serviceAccount = serviceAccount
    } else {
      fail(`unsupported argument: ${value}`)
    }
  }

  if (options.command !== 'upload-testing') {
    fail('command must be upload-testing')
  }
  return options
}

function assertTestingTracksUpdated(snapshot, versionCode) {
  const expectedVersionCode = String(versionCode)
  for (const track of TESTING_TRACKS) {
    const normalized = normalizeTrack(snapshot[track])
    if (
      normalized.releases.length !== 1 ||
      normalized.releases[0].status !== 'completed' ||
      normalized.releases[0].versionCodes.length !== 1 ||
      normalized.releases[0].versionCodes[0] !== expectedVersionCode
    ) {
      fail(`testing Google Play track was not updated as requested: ${track}`)
    }
  }
}

async function runTestingEdit(accessToken, appContract, options) {
  await withTemporaryEdit(
    accessToken,
    appContract.packageName,
    async (editId, markCommitted) => {
      if (!options.aab) fail('--aab is required for upload-testing')
      const aabPath = path.resolve(options.aab)
      if (!fs.existsSync(aabPath) || !fs.statSync(aabPath).isFile()) {
        fail(`AAB not found: ${aabPath}`)
      }

      const [testingBefore, immutableBefore] = await Promise.all([
        snapshotTracks(
          accessToken,
          appContract.packageName,
          editId,
          TESTING_TRACKS
        ),
        snapshotTracks(
          accessToken,
          appContract.packageName,
          editId,
          IMMUTABLE_TRACKS
        ),
      ])
      const maxPublishedVersionCode = maxVersionCodeFromTracks([
        ...Object.values(testingBefore),
        ...Object.values(immutableBefore),
      ])
      if (appContract.versionCode <= maxPublishedVersionCode) {
        fail(
          `app.json versionCode ${appContract.versionCode} must be greater than Play versionCode ${maxPublishedVersionCode}`
        )
      }

      const bundle = await uploadBundle(
        accessToken,
        appContract.packageName,
        editId,
        aabPath
      )
      const versionCode = Number(bundle.versionCode)
      if (versionCode !== appContract.versionCode) {
        fail(
          `uploaded AAB versionCode ${versionCode} does not match app.json ${appContract.versionCode}`
        )
      }

      await Promise.all(
        TESTING_TRACKS.map((track) =>
          setTrackRelease(
            accessToken,
            appContract.packageName,
            editId,
            track,
            versionCode
          )
        )
      )

      const [testingAfter, immutableAfter] = await Promise.all([
        snapshotTracks(
          accessToken,
          appContract.packageName,
          editId,
          TESTING_TRACKS
        ),
        snapshotTracks(
          accessToken,
          appContract.packageName,
          editId,
          IMMUTABLE_TRACKS
        ),
      ])
      assertTestingTracksUpdated(testingAfter, versionCode)
      assertTracksUnchanged(
        immutableBefore,
        immutableAfter,
        IMMUTABLE_TRACKS
      )
      await validateEdit(accessToken, appContract.packageName, editId)

      if (!options.commit) {
        process.stdout.write(
          `[android-play-testing] alpha/internal edit for versionCode ${versionCode} validated; no commit requested.\n`
        )
        return
      }

      await commitEdit(accessToken, appContract.packageName, editId)
      markCommitted()
      process.stdout.write(
        `[android-play-testing] alpha/internal release committed for versionCode ${versionCode}. Production and beta were unchanged.\n`
      )
    }
  )
}

async function main(argv = process.argv.slice(2)) {
  const options = parseTestingArgs(argv)
  acquireLock()
  try {
    const appContract = readAppContract()
    const account = loadServiceAccount(path.resolve(options.serviceAccount))
    const accessToken = await getAccessToken(account)
    await runTestingEdit(accessToken, appContract, options)
    if (options.commit) {
      await runStatus(accessToken, appContract.packageName)
    }
  } finally {
    releaseLock()
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`[android-play-testing] ERROR: ${error.message}\n`)
    process.exitCode = 1
  })
}

module.exports = {
  IMMUTABLE_TRACKS,
  TESTING_TRACKS,
  assertTestingTracksUpdated,
  parseTestingArgs,
}
