import { deriveUsernameFromEmail } from '@/utils/deriveUsername'

describe('deriveUsernameFromEmail', () => {
  it('takes the local part of the email', () => {
    expect(deriveUsernameFromEmail('john.doe@example.com')).toBe('john.doe')
  })

  it('trims surrounding whitespace before splitting', () => {
    expect(deriveUsernameFromEmail('  traveler@metravel.by  ')).toBe('traveler')
  })

  it('collapses internal whitespace in the local part', () => {
    expect(deriveUsernameFromEmail('john   doe@example.com')).toBe('john doe')
  })

  it('falls back for empty or malformed input', () => {
    expect(deriveUsernameFromEmail('')).toBe('traveler')
    expect(deriveUsernameFromEmail(null)).toBe('traveler')
    expect(deriveUsernameFromEmail(undefined)).toBe('traveler')
    expect(deriveUsernameFromEmail('@example.com')).toBe('traveler')
  })

  it('caps the derived name at 50 characters', () => {
    const long = `${'a'.repeat(80)}@example.com`
    expect(deriveUsernameFromEmail(long)).toHaveLength(50)
  })
})
