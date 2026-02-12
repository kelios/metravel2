const COMMENT_MARKER = '<!-- validator-guard-comment -->'
const COMMENT_HEADER = '### Validator Guard Comment'

const buildFallbackComment = ({
  runUrl = '',
  artifactUrl = '',
  reason = 'Unable to load generated guard comment preview.',
} = {}) => {
  const lines = [
    COMMENT_MARKER,
    COMMENT_HEADER,
    '',
    '- Status: FAIL',
    `- Reason: ${String(reason || 'Unable to load generated guard comment preview.')}`,
  ]

  const runLink = String(runUrl || '').trim()
  if (runLink) {
    lines.push(`- Workflow run: ${runLink}`)
  }

  const artifactLink = String(artifactUrl || '').trim()
  if (artifactLink) {
    lines.push(`- Guard artifact: ${artifactLink}`)
  }

  lines.push('')
  return lines.join('\n')
}

module.exports = {
  COMMENT_MARKER,
  COMMENT_HEADER,
  buildFallbackComment,
}
