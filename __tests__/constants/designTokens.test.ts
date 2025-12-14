import { designTokens, getColor, getSpacing, fluidTypography, responsiveValue } from '@/constants/designTokens'

describe('designTokens helpers', () => {
  it('returns nested colors and spacing safely', () => {
    expect(getColor('primary.600')).toBe(designTokens.colors.primary[600])
    expect(getColor('semantic.error')).toBe(designTokens.colors.semantic.error)
    expect(getSpacing(4)).toBe(designTokens.spacing[4])
    expect(getColor('missing.path')).toBeUndefined()
  })

  it('keeps responsive map and builds fluid typography string', () => {
    const map = responsiveValue({ sm: 12, lg: 20 })
    expect(map).toEqual({ sm: 12, lg: 20 })

    const fluid = fluidTypography(14, 24, 360, 1440)
    expect(fluid).toContain('clamp(')
    expect(fluid).toContain('vw')
  })
})
