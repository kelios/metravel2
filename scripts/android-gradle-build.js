#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const ANDROID_DIR = path.join(ROOT_DIR, 'android')
const PROD_ENV_PATH = path.join(ROOT_DIR, '.env.prod')

function parseEnvFile(filePath) {
  const variables = {}
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) variables[key] = value
  }
  return variables
}

const mode = process.argv[2]
if (!['debug', 'production'].includes(mode)) {
  process.stderr.write('[android-gradle] mode must be debug or production\n')
  process.exit(2)
}

const gradleExecutable = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const task = mode === 'production' ? ':app:bundleRelease' : ':app:assembleDebug'
let buildEnvironment = { ...process.env }

if (mode === 'production') {
  if (!fs.existsSync(PROD_ENV_PATH)) {
    process.stderr.write('[android-gradle] .env.prod is required for a production AAB\n')
    process.exit(1)
  }
  buildEnvironment = {
    ...buildEnvironment,
    ...parseEnvFile(PROD_ENV_PATH),
    NODE_ENV: 'production',
    EXPO_ENV: 'prod',
    EXPO_NO_INTERACTIVE: '1',
  }
}

const result = spawnSync(gradleExecutable, [task], {
  cwd: ANDROID_DIR,
  env: buildEnvironment,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

if (result.error) {
  process.stderr.write(`[android-gradle] ${result.error.message}\n`)
  process.exit(1)
}
process.exit(result.status ?? 1)
