const parseSelectiveRunnerArgs = (argv) => {
  const args = {
    changedFilesFile: '',
    dryRun: false,
    output: 'text',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--changed-files-file' && argv[i + 1]) {
      args.changedFilesFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (token === '--json') {
      args.output = 'json'
      continue
    }
  }

  return args
}

module.exports = {
  parseSelectiveRunnerArgs,
}
