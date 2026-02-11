const fs = require('fs')

const REQUIRED_FIELDS = [
  'Business reason',
  'Risk statement',
  'Rollback plan',
  'Owner',
  'Fix deadline (YYYY-MM-DD)',
]

const isTruthy = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

const readPrBody = () => {
  const fromEnv = String(process.env.PR_BODY || '')
  if (fromEnv.trim()) return fromEnv

  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath) return ''
  if (!fs.existsSync(eventPath)) return ''

  try {
    const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    return String(payload?.pull_request?.body || '')
  } catch {
    return ''
  }
}

const extractFieldValue = (body, fieldLabel) => {
  const escaped = fieldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regexp = new RegExp(`^\\s*[-*]?\\s*${escaped}:\\s*(.*)\\s*$`, 'im')
  const match = body.match(regexp)
  return String(match?.[1] || '').trim()
}

const isPlaceholder = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return true
  return (
    normalized === 'tbd' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === '-' ||
    normalized === 'none' ||
    normalized === 'todo' ||
    normalized.startsWith('<') ||
    normalized.startsWith('[')
  )
}

const parseExceptionSection = (body) => {
  const requested = /-\s*\[[xX]\]\s*Exception requested/.test(body)
  const fields = Object.fromEntries(
    REQUIRED_FIELDS.map((label) => [label, extractFieldValue(body, label)])
  )
  return { requested, fields }
}

const validateException = ({ body, requireException }) => {
  const { requested, fields } = parseExceptionSection(body)
  const errors = []

  if (requireException && !requested) {
    errors.push('Exception is required because CI gate failed, but "Exception requested" is not checked.')
  }

  if (requested) {
    for (const label of REQUIRED_FIELDS) {
      const value = fields[label]
      if (isPlaceholder(value)) {
        errors.push(`Field "${label}" must be filled with a concrete value.`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    requested,
    fields,
    errors,
  }
}

const main = () => {
  const body = readPrBody()
  const requireException = isTruthy(process.env.REQUIRE_EXCEPTION)
  const result = validateException({ body, requireException })

  if (!result.requested && !requireException) {
    console.log('PR CI exception validation: no exception requested (not required).')
    return
  }

  if (result.valid) {
    console.log('PR CI exception validation: passed.')
    return
  }

  console.log('PR CI exception validation: failed.')
  result.errors.forEach((err) => console.log(`- ${err}`))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  REQUIRED_FIELDS,
  parseExceptionSection,
  validateException,
}
