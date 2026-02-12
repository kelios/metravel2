const { ERROR_CODES } = require('@/scripts/validator-error-codes')

describe('validator-error-codes uniqueness', () => {
  it('keeps all error code values unique across namespaces', () => {
    const collisions = []
    const seen = new Map()

    for (const [namespace, entries] of Object.entries(ERROR_CODES || {})) {
      for (const [key, value] of Object.entries(entries || {})) {
        const code = String(value || '').trim()
        const location = `${namespace}.${key}`
        if (!code) continue

        const existing = seen.get(code)
        if (existing) {
          collisions.push({ code, first: existing, second: location })
          continue
        }
        seen.set(code, location)
      }
    }

    expect(collisions).toEqual([])
  })
})
