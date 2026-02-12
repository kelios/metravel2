const fs = require('fs')
const path = require('path')
const { makeTempDir, writeJsonFile, writeTextFile } = require('./cli-test-utils')
const {
  parseFileArg,
  readTextFile,
  readJsonFile,
  extractMarkdownLineValue,
  isPlaceholderValue,
} = require('@/scripts/validation-utils')

describe('validation-utils', () => {
  it('parses --file argument with fallback default', () => {
    expect(parseFileArg([], 'default.txt')).toEqual({ file: 'default.txt' })
    expect(parseFileArg(['--file', 'custom.txt'], 'default.txt')).toEqual({ file: 'custom.txt' })
  })

  it('reads text and json files', () => {
    const dir = makeTempDir('validation-utils-')
    const textPath = path.join(dir, 'note.txt')
    const jsonPath = path.join(dir, 'data.json')
    writeTextFile(textPath, 'hello')
    writeJsonFile(jsonPath, { a: 1 })

    expect(readTextFile(textPath, 'text file')).toBe('hello')
    expect(readJsonFile(jsonPath, 'json file')).toEqual({ a: 1 })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('extracts markdown line value by label', () => {
    const markdown = '- Failure Class: smoke_only\n- Recommendation ID: QG-004\n'
    expect(extractMarkdownLineValue(markdown, 'Failure Class')).toBe('smoke_only')
    expect(extractMarkdownLineValue(markdown, 'Recommendation ID')).toBe('QG-004')
  })

  it('detects placeholder values', () => {
    expect(isPlaceholderValue('<fill>')).toBe(true)
    expect(isPlaceholderValue('[todo]')).toBe(true)
    expect(isPlaceholderValue('')).toBe(true)
    expect(isPlaceholderValue('value')).toBe(false)
  })
})
