const fs = require('fs')
const path = require('path')
const { makeTempDir, writeTextFile } = require('./cli-test-utils')
const { readChangedFiles, readChangedFilesWithMeta } = require('@/scripts/changed-files-utils')

describe('changed-files-utils', () => {
  it('reads changed files from file when file exists', () => {
    const dir = makeTempDir('changed-files-utils-')
    const filePath = path.join(dir, 'changed.txt')
    writeTextFile(filePath, 'a\nb\n\n')

    expect(readChangedFiles({ changedFilesFile: filePath })).toEqual(['a', 'b'])
    expect(readChangedFilesWithMeta({ changedFilesFile: filePath })).toEqual({
      files: ['a', 'b'],
      source: 'file',
      available: true,
    })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('falls back to env var when file is absent', () => {
    process.env.CHANGED_FILES = 'x\ny\n'
    expect(readChangedFiles({ changedFilesFile: '/tmp/does-not-exist' })).toEqual(['x', 'y'])
    expect(readChangedFilesWithMeta({ changedFilesFile: '/tmp/does-not-exist' })).toEqual({
      files: ['x', 'y'],
      source: 'env',
      available: true,
    })
    delete process.env.CHANGED_FILES
  })

  it('supports custom env variable name', () => {
    process.env.CUSTOM_CHANGED = 'one\ntwo\n'
    expect(readChangedFiles({ envVarName: 'CUSTOM_CHANGED' })).toEqual(['one', 'two'])
    delete process.env.CUSTOM_CHANGED
  })

  it('returns unavailable meta when no input source exists', () => {
    delete process.env.CHANGED_FILES
    expect(readChangedFilesWithMeta({ changedFilesFile: '/tmp/does-not-exist' })).toEqual({
      files: [],
      source: 'none',
      available: false,
    })
  })
})
