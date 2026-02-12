const fs = require('fs')
const path = require('path')
const { readJsonFileWithStatus } = require('./summary-utils')
const { COMMENT_MARKER } = require('./validator-guard-comment-template')

const parseArgs = (argv) => {
  const args = {
    file: 'test-results/validator-guard.json',
    outputFile: 'test-results/validator-guard-comment.md',
    runUrl: '',
    artifactUrl: '',
    qualitySummaryUrl: '',
    commentArtifactUrl: '',
    output: 'text',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--output-file' && argv[i + 1]) {
      args.outputFile = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--run-url' && argv[i + 1]) {
      args.runUrl = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--artifact-url' && argv[i + 1]) {
      args.artifactUrl = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--quality-summary-url' && argv[i + 1]) {
      args.qualitySummaryUrl = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--comment-artifact-url' && argv[i + 1]) {
      args.commentArtifactUrl = argv[i + 1]
      i += 1
      continue
    }
    if (token === '--json') {
      args.output = 'json'
      continue
    }
  }
  return args
}

const toList = (value) => (Array.isArray(value) ? value : [])

const buildCommentMarkdown = ({
  file,
  payload,
  missing,
  parseError,
  runUrl = '',
  artifactUrl = '',
  qualitySummaryUrl = '',
  commentArtifactUrl = '',
}) => {
  const runLink = String(runUrl || '').trim()
  const artifactLink = String(artifactUrl || '').trim()
  const qualitySummaryLink = String(qualitySummaryUrl || '').trim()
  const commentArtifactLink = String(commentArtifactUrl || '').trim()
  if (missing) {
    const lines = [
      COMMENT_MARKER,
      '### Validator Guard Comment',
      '',
      `- Result file not found: \`${file}\``,
      '',
      '_Guard comment cannot be rendered because input artifact is missing._',
      '',
    ]
    if (runLink) lines.splice(3, 0, `- Workflow run: ${runLink}`)
    if (artifactLink) lines.splice(4, 0, `- Guard artifact: ${artifactLink}`)
    if (qualitySummaryLink) lines.splice(5, 0, `- Quality summary artifact: ${qualitySummaryLink}`)
    if (commentArtifactLink) lines.splice(6, 0, `- Guard comment artifact: ${commentArtifactLink}`)
    return lines.join('\n')
  }

  if (parseError) {
    const lines = [
      COMMENT_MARKER,
      '### Validator Guard Comment',
      '',
      `- Failed to parse \`${file}\`: ${parseError}`,
      '',
      '_Guard comment cannot be rendered because input artifact is invalid JSON._',
      '',
    ]
    if (runLink) lines.splice(3, 0, `- Workflow run: ${runLink}`)
    if (artifactLink) lines.splice(4, 0, `- Guard artifact: ${artifactLink}`)
    if (qualitySummaryLink) lines.splice(5, 0, `- Quality summary artifact: ${qualitySummaryLink}`)
    if (commentArtifactLink) lines.splice(6, 0, `- Guard comment artifact: ${commentArtifactLink}`)
    return lines.join('\n')
  }

  const ok = Boolean(payload?.ok)
  const reason = String(payload?.reason || '').trim() || 'No reason provided.'
  const touched = toList(payload?.touchedFiles)
  const missingFiles = toList(payload?.missing)
  const hints = toList(payload?.hints)

  const lines = [
    COMMENT_MARKER,
    '### Validator Guard Comment',
    '',
    `- Status: ${ok ? 'PASS' : 'FAIL'}`,
    `- Reason: ${reason}`,
    `- Touched files: ${touched.length}`,
    `- Missing companions: ${missingFiles.length}`,
  ]
  if (runLink) {
    lines.push(`- Workflow run: ${runLink}`)
  }
  if (artifactLink) {
    lines.push(`- Guard artifact: ${artifactLink}`)
  }
  if (qualitySummaryLink) {
    lines.push(`- Quality summary artifact: ${qualitySummaryLink}`)
  }
  if (commentArtifactLink) {
    lines.push(`- Guard comment artifact: ${commentArtifactLink}`)
  }

  if (touched.length > 0) {
    lines.push('- Touched:')
    touched.slice(0, 8).forEach((entry) => lines.push(`  - \`${String(entry)}\``))
  }

  if (missingFiles.length > 0) {
    lines.push('- Missing required files:')
    missingFiles.slice(0, 8).forEach((entry) => lines.push(`  - \`${String(entry)}\``))
  }

  if (hints.length > 0) {
    lines.push('- Hints:')
    hints.slice(0, 6).forEach((entry) => lines.push(`  - ${String(entry)}`))
  }

  lines.push('')
  return lines.join('\n')
}

const writeOutput = (outputFile, markdown) => {
  const resolved = path.resolve(process.cwd(), outputFile)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, markdown, 'utf8')
  return resolved
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const parsed = readJsonFileWithStatus(args.file)
  const markdown = buildCommentMarkdown({
    file: args.file,
    payload: parsed.payload,
    missing: parsed.missing,
    parseError: parsed.parseError,
    runUrl: args.runUrl,
    artifactUrl: args.artifactUrl,
    qualitySummaryUrl: args.qualitySummaryUrl,
    commentArtifactUrl: args.commentArtifactUrl,
  })
  const outputFile = writeOutput(args.outputFile, markdown)

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify({ outputFile, markdown }, null, 2)}\n`)
    return
  }
  process.stdout.write(`${markdown}\n`)
}

if (require.main === module) {
  main()
}

module.exports = {
  COMMENT_MARKER,
  parseArgs,
  buildCommentMarkdown,
  writeOutput,
}
