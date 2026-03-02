/**
 * scripts/lib/validator.js
 * Shared validation primitives for CI guard/validate scripts.
 */

/** Assert a condition, throw with label if false */
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

/** Validate that required fields exist on an object */
const requireFields = (obj, fields, context = 'object') => {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '')
  if (missing.length > 0) {
    throw new Error(`${context}: missing required fields: ${missing.join(', ')}`)
  }
}

/** Validate a JSON object against a simple schema { field: 'string'|'number'|'boolean'|'array'|'object' } */
const validateShape = (obj, schema, context = 'payload') => {
  const errors = []
  for (const [key, expectedType] of Object.entries(schema)) {
    const value = obj[key]
    if (value === undefined || value === null) {
      errors.push(`${key}: missing`)
      continue
    }
    if (expectedType === 'array') {
      if (!Array.isArray(value)) errors.push(`${key}: expected array, got ${typeof value}`)
    } else if (typeof value !== expectedType) {
      errors.push(`${key}: expected ${expectedType}, got ${typeof value}`)
    }
  }
  if (errors.length > 0) {
    throw new Error(`${context} validation failed:\n  ${errors.join('\n  ')}`)
  }
}

/** Format validation result for CI output */
const formatValidationResult = ({ passed, label, details }) => {
  const icon = passed ? '✅' : '❌'
  const lines = [`${icon} ${label}`]
  if (details && details.length > 0) {
    details.forEach((d) => lines.push(`  - ${d}`))
  }
  return lines.join('\n')
}

module.exports = {
  assert,
  requireFields,
  validateShape,
  formatValidationResult,
}

