const fs = require('fs')
const os = require('os')
const path = require('path')
const { readChangedFiles } = require('@/scripts/changed-files-utils')

describe('changed-files-utils', () => {
  it('reads changed files from file when file exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changed-files-utils-'))
    const filePath = path.join(dir, 'changed.txt')
    fs.writeFileSync(filePath, 'a\nb\n\n', 'utf8')

    expect(readChangedFiles({ changedFilesFile: filePath })).toEqual(['a', 'b'])
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('falls back to env var when file is absent', () => {
    process.env.CHANGED_FILES = 'x\ny\n'
    expect(readChangedFiles({ changedFilesFile: '/tmp/does-not-exist' })).toEqual(['x', 'y'])
    delete process.env.CHANGED_FILES
  })

  it('supports custom env variable name', () => {
    process.env.CUSTOM_CHANGED = 'one\ntwo\n'
    expect(readChangedFiles({ envVarName: 'CUSTOM_CHANGED' })).toEqual(['one', 'two'])
    delete process.env.CUSTOM_CHANGED
  })
})
