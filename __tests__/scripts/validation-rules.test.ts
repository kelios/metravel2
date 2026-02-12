const { isConcreteValue, isHttpUrl } = require('@/scripts/validation-rules')

describe('validation-rules', () => {
  it('checks concrete values via shared placeholder rule', () => {
    expect(isConcreteValue('<fill>')).toBe(false)
    expect(isConcreteValue('[todo]')).toBe(false)
    expect(isConcreteValue('')).toBe(false)
    expect(isConcreteValue('ready')).toBe(true)
  })

  it('checks absolute http/https URLs', () => {
    expect(isHttpUrl('https://example.com/run/1')).toBe(true)
    expect(isHttpUrl('http://example.com/path')).toBe(true)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('not-a-url')).toBe(false)
    expect(isHttpUrl('<link>')).toBe(false)
  })
})
