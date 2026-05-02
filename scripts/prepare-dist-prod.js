#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function copyDistToProd({
  srcDir = path.resolve('dist'),
  destDir = path.resolve('dist/prod'),
} = {}) {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source dist directory not found: ${srcDir}`)
  }

  const srcParentDir = path.dirname(srcDir)
  const tempDir = path.join(srcParentDir, '.prod-build-tmp')
  const destDirReal = fs.existsSync(destDir) ? fs.realpathSync(destDir) : destDir

  fs.rmSync(tempDir, { recursive: true, force: true })
  fs.mkdirSync(tempDir, { recursive: true })

  fs.cpSync(srcDir, tempDir, {
    recursive: true,
    force: true,
    filter: (entry) => {
      const absoluteEntry = path.resolve(entry)
      if (absoluteEntry === tempDir) return false
      if (absoluteEntry === destDirReal) return false
      return !absoluteEntry.startsWith(`${destDirReal}${path.sep}`)
    },
  })

  if (!fs.existsSync(path.join(tempDir, 'index.html'))) {
    throw new Error(`Temporary dist snapshot is missing: ${tempDir}`)
  }

  fs.rmSync(destDir, { recursive: true, force: true })
  try {
    fs.renameSync(tempDir, destDir)
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error
    }

    fs.cpSync(tempDir, destDir, { recursive: true, force: true })
  }
  fs.rmSync(path.join(destDir, 'prod'), { recursive: true, force: true })
  fs.rmSync(tempDir, { recursive: true, force: true })

  return destDir
}

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1]
  }
  return fallback
}

if (require.main === module) {
  try {
    const preparedDir = copyDistToProd({
      srcDir: path.resolve(getArgValue('--src', 'dist')),
      destDir: path.resolve(getArgValue('--dest', 'dist/prod')),
    })
    console.log(`[prepare-dist-prod] Prepared ${preparedDir}`)
  } catch (error) {
    console.error(`[prepare-dist-prod] ${error.message}`)
    process.exit(1)
  }
}

module.exports = {
  copyDistToProd,
}
