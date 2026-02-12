const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./cli-test-utils')
const {
  parseArgs,
  normalizeChangedFiles,
  ensureShas,
  writeChangedFiles,
} = require('@/scripts/collect-changed-files')

describe('collect-changed-files', () => {
  it('parses args and supports overrides', () => {
    expect(parseArgs([])).toEqual({
      baseSha: '',
      headSha: '',
      outputFile: 'changed_files.txt',
    })

    expect(parseArgs(['--base-sha', 'base123', '--head-sha', 'head456', '--output-file', 'tmp/changed.txt'])).toEqual({
      baseSha: 'base123',
      headSha: 'head456',
      outputFile: 'tmp/changed.txt',
    })
  })

  it('normalizes changed file output', () => {
    expect(normalizeChangedFiles('a\nb\n\n c \n')).toEqual(['a', 'b', 'c'])
  })

  it('requires both SHAs', () => {
    expect(() => ensureShas({ baseSha: '', headSha: 'h' })).toThrow('required')
    expect(() => ensureShas({ baseSha: 'b', headSha: '' })).toThrow('required')
    expect(() => ensureShas({ baseSha: 'b', headSha: 'h' })).not.toThrow()
  })

  it('writes changed files to output path', () => {
    const dir = makeTempDir('changed-files-')
    const output = path.join(dir, 'changed.txt')
    const resolved = writeChangedFiles(output, ['a', 'b'])
    expect(resolved).toBe(path.resolve(output))
    expect(fs.readFileSync(output, 'utf8')).toBe('a\nb\n')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
