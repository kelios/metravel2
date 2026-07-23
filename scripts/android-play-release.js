#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const { resolveServiceAccountPath } = require('./android-release-secrets')

const ROOT_DIR = path.resolve(__dirname, '..')
const APP_CONFIG_PATH = path.join(ROOT_DIR, 'app.json')
const API_ROOT = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'
const UPLOAD_ROOT = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher'
const PROTECTED_TRACKS = Object.freeze(['alpha', 'internal', 'beta'])
const LOCK_DIR = path.join(ROOT_DIR, '.codex-temp', 'ops', 'android-play-release.lock')

function fail(message) {
  throw new Error(message)
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found: ${filePath}`)
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    fail(`${label} is not valid JSON: ${filePath}`)
  }
}

function readAppContract() {
  const appConfig = readJson(APP_CONFIG_PATH, 'app.json')
  const packageName = appConfig?.expo?.android?.package
  const versionCode = Number(appConfig?.expo?.android?.versionCode)
  if (!packageName || !Number.isInteger(versionCode) || versionCode <= 0) {
    fail('app.json must define expo.android.package and a positive integer versionCode')
  }
  return { packageName, versionCode }
}

function loadServiceAccount(filePath) {
  const account = readJson(filePath, 'Google Play service account')
  if (account.type !== 'service_account' || !account.client_email || !account.private_key) {
    fail('Google Play credentials must be a service-account JSON key')
  }
  return account
}

function createServiceAccountAssertion(account, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: ANDROID_PUBLISHER_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds - 30,
      exp: nowSeconds + 3600,
    })
  )
  const unsigned = `${header}.${payload}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key)
  return `${unsigned}.${base64Url(signature)}`
}

async function getAccessToken(account) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createServiceAccountAssertion(account),
    }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.access_token) {
    fail(`Google OAuth failed (${response.status}): ${body?.error_description || 'unknown error'}`)
  }
  return body.access_token
}

async function googleRequest(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body && !Buffer.isBuffer(options.body)
        ? { 'Content-Type': 'application/json; charset=utf-8' }
        : {}),
      ...options.headers,
    },
  })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }
  if (!response.ok) {
    const message = body?.error?.message || `HTTP ${response.status}`
    fail(`Google Play API failed (${response.status}): ${message}`)
  }
  return body
}

function editUrl(packageName, suffix = '') {
  return `${API_ROOT}/${encodeURIComponent(packageName)}/edits${suffix}`
}

async function createEdit(accessToken, packageName) {
  return googleRequest(accessToken, editUrl(packageName), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

async function deleteEdit(accessToken, packageName, editId) {
  await googleRequest(accessToken, editUrl(packageName, `/${encodeURIComponent(editId)}`), {
    method: 'DELETE',
  })
}

async function getTrack(accessToken, packageName, editId, track) {
  return googleRequest(
    accessToken,
    editUrl(packageName, `/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(track)}`)
  )
}

function normalizeTrack(track) {
  return {
    track: track?.track || '',
    releases: (track?.releases || [])
      .map((release) => ({
        name: release.name || '',
        status: release.status || '',
        userFraction: release.userFraction ?? null,
        versionCodes: [...(release.versionCodes || [])].map(String).sort((a, b) => Number(a) - Number(b)),
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  }
}

async function snapshotProtectedTracks(accessToken, packageName, editId) {
  return snapshotTracks(accessToken, packageName, editId, PROTECTED_TRACKS)
}

async function snapshotTracks(accessToken, packageName, editId, tracks) {
  const entries = await Promise.all(
    tracks.map(async (track) => [
      track,
      normalizeTrack(await getTrack(accessToken, packageName, editId, track)),
    ])
  )
  return Object.fromEntries(entries)
}

function assertProtectedTracksUnchanged(before, after) {
  assertTracksUnchanged(before, after, PROTECTED_TRACKS, 'protected')
}

function assertTracksUnchanged(before, after, tracks, label = 'immutable') {
  for (const track of tracks) {
    if (JSON.stringify(before[track]) !== JSON.stringify(after[track])) {
      fail(`${label} Google Play track changed inside the edit: ${track}`)
    }
  }
}

function maxVersionCodeFromTracks(tracks) {
  const versionCodes = tracks.flatMap((track) =>
    (track?.releases || []).flatMap((release) => release.versionCodes || []).map(Number)
  )
  const validVersionCodes = versionCodes.filter(
    (versionCode) => Number.isInteger(versionCode) && versionCode > 0
  )
  return validVersionCodes.length ? Math.max(...validVersionCodes) : 0
}

async function uploadBundle(accessToken, packageName, editId, aabPath) {
  const url = `${UPLOAD_ROOT}/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(
    editId
  )}/bundles?uploadType=media`
  return googleRequest(accessToken, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(aabPath),
  })
}

async function setTrackRelease(accessToken, packageName, editId, track, versionCode) {
  return googleRequest(
    accessToken,
    editUrl(packageName, `/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(track)}`),
    {
      method: 'PUT',
      body: JSON.stringify({
        track,
        releases: [{ status: 'completed', versionCodes: [String(versionCode)] }],
      }),
    }
  )
}

async function setProductionRelease(accessToken, packageName, editId, versionCode) {
  return setTrackRelease(accessToken, packageName, editId, 'production', versionCode)
}

async function validateEdit(accessToken, packageName, editId) {
  return googleRequest(
    accessToken,
    editUrl(packageName, `/${encodeURIComponent(editId)}:validate`),
    { method: 'POST', body: JSON.stringify({}) }
  )
}

async function commitEdit(accessToken, packageName, editId) {
  return googleRequest(
    accessToken,
    editUrl(packageName, `/${encodeURIComponent(editId)}:commit`),
    { method: 'POST', body: JSON.stringify({}) }
  )
}

function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_DIR), { recursive: true })
  try {
    fs.mkdirSync(LOCK_DIR)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const pidPath = path.join(LOCK_DIR, 'pid')
    const ownerPid = Number(fs.existsSync(pidPath) ? fs.readFileSync(pidPath, 'utf8').trim() : '')
    if (Number.isInteger(ownerPid) && ownerPid > 0) {
      try {
        process.kill(ownerPid, 0)
        fail(`another Android Play operation is active (PID ${ownerPid})`)
      } catch (processError) {
        if (processError.code !== 'ESRCH') throw processError
      }
    }
    fs.rmSync(LOCK_DIR, { recursive: true, force: true })
    fs.mkdirSync(LOCK_DIR)
  }
  fs.writeFileSync(path.join(LOCK_DIR, 'pid'), `${process.pid}\n`, { mode: 0o600 })
}

function releaseLock() {
  fs.rmSync(LOCK_DIR, { recursive: true, force: true })
}

async function withTemporaryEdit(accessToken, packageName, callback) {
  const edit = await createEdit(accessToken, packageName)
  let committed = false
  try {
    const result = await callback(edit.id, () => {
      committed = true
    })
    return result
  } finally {
    if (!committed) {
      await deleteEdit(accessToken, packageName, edit.id).catch((error) => {
        process.stderr.write(`[android-play] WARNING: could not delete temporary edit: ${error.message}\n`)
      })
    }
  }
}

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv
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
  return options
}

function printTrack(track) {
  const releases = normalizeTrack(track).releases
  const summary = releases.length
    ? releases.map((release) => `${release.status}:${release.versionCodes.join(',') || '-'}`).join(' | ')
    : 'empty'
  process.stdout.write(`[android-play] ${track.track}: ${summary}\n`)
}

async function runStatus(accessToken, packageName) {
  await withTemporaryEdit(accessToken, packageName, async (editId) => {
    const tracks = await Promise.all(
      [...PROTECTED_TRACKS, 'production'].map((track) =>
        getTrack(accessToken, packageName, editId, track)
      )
    )
    tracks.forEach(printTrack)
  })
  process.stdout.write('[android-play] Read-only status complete; temporary edit deleted.\n')
}

async function runProductionEdit(accessToken, appContract, options) {
  await withTemporaryEdit(accessToken, appContract.packageName, async (editId, markCommitted) => {
    const protectedBefore = await snapshotProtectedTracks(
      accessToken,
      appContract.packageName,
      editId
    )

    if (!options.aab) fail('--aab is required for upload-production')
    const aabPath = path.resolve(options.aab)
    if (!fs.existsSync(aabPath) || !fs.statSync(aabPath).isFile()) {
      fail(`AAB not found: ${aabPath}`)
    }

    const productionBefore = await getTrack(
      accessToken,
      appContract.packageName,
      editId,
      'production'
    )
    const maxPublishedVersionCode = maxVersionCodeFromTracks([
      ...Object.values(protectedBefore),
      productionBefore,
    ])
    if (appContract.versionCode <= maxPublishedVersionCode) {
      fail(
        `app.json versionCode ${appContract.versionCode} must be greater than Play versionCode ${maxPublishedVersionCode}`
      )
    }

    const bundle = await uploadBundle(accessToken, appContract.packageName, editId, aabPath)
    const versionCode = Number(bundle.versionCode)
    if (versionCode !== appContract.versionCode) {
      fail(
        `uploaded AAB versionCode ${versionCode} does not match app.json ${appContract.versionCode}`
      )
    }

    await setProductionRelease(accessToken, appContract.packageName, editId, versionCode)
    const protectedAfter = await snapshotProtectedTracks(
      accessToken,
      appContract.packageName,
      editId
    )
    assertProtectedTracksUnchanged(protectedBefore, protectedAfter)
    await validateEdit(accessToken, appContract.packageName, editId)

    if (!options.commit) {
      process.stdout.write(
        `[android-play] Production edit for versionCode ${versionCode} validated; no commit requested.\n`
      )
      return
    }

    await commitEdit(accessToken, appContract.packageName, editId)
    markCommitted()
    process.stdout.write(
      `[android-play] Production release committed for versionCode ${versionCode}. Protected testing tracks were unchanged.\n`
    )
  })
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (!['status', 'upload-production'].includes(options.command)) {
    fail('command must be status or upload-production')
  }
  if (options.command === 'status' && (options.commit || options.aab)) {
    fail('status does not accept release arguments')
  }

  acquireLock()
  try {
    const appContract = readAppContract()
    const account = loadServiceAccount(path.resolve(options.serviceAccount))
    const accessToken = await getAccessToken(account)
    if (options.command === 'status') {
      await runStatus(accessToken, appContract.packageName)
    } else {
      await runProductionEdit(accessToken, appContract, options)
      if (options.commit) {
        await runStatus(accessToken, appContract.packageName)
      }
    }
  } finally {
    releaseLock()
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`[android-play] ERROR: ${error.message}\n`)
    process.exitCode = 1
  })
}

module.exports = {
  PROTECTED_TRACKS,
  acquireLock,
  assertProtectedTracksUnchanged,
  assertTracksUnchanged,
  base64Url,
  commitEdit,
  createServiceAccountAssertion,
  getAccessToken,
  getTrack,
  loadServiceAccount,
  maxVersionCodeFromTracks,
  normalizeTrack,
  parseArgs,
  readAppContract,
  releaseLock,
  runStatus,
  setTrackRelease,
  snapshotTracks,
  uploadBundle,
  validateEdit,
  withTemporaryEdit,
}
