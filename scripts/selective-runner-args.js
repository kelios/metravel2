const parseSelectiveRunnerArgs = (argv) => {
  const args = {
    changedFilesFile: '',
    dryRun: false,
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
  }

  return args
}

module.exports = {
  parseSelectiveRunnerArgs,
}
