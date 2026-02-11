const { parseSelectiveRunnerArgs } = require('@/scripts/selective-runner-args')

describe('selective-runner-args', () => {
  it('parses defaults', () => {
    expect(parseSelectiveRunnerArgs([])).toEqual({
      changedFilesFile: '',
      dryRun: false,
      output: 'text',
    })
  })

  it('parses changed-files-file and dry-run flags', () => {
    expect(parseSelectiveRunnerArgs([
      '--changed-files-file',
      'changed_files.txt',
      '--dry-run',
    ])).toEqual({
      changedFilesFile: 'changed_files.txt',
      dryRun: true,
      output: 'text',
    })
  })

  it('parses json output flag', () => {
    expect(parseSelectiveRunnerArgs(['--dry-run', '--json'])).toEqual({
      changedFilesFile: '',
      dryRun: true,
      output: 'json',
    })
  })
})
