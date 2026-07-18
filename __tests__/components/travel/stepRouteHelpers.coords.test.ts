import { parseCoordinate, parseCoordsPair, toggleNumericSign } from '@/components/travel/stepRoute/helpers'

describe('stepRoute coordinate parsing (Android manual point entry)', () => {
  describe('parseCoordinate', () => {
    it('parses a plain dot decimal', () => {
      expect(parseCoordinate('53.9')).toBe(53.9)
    })

    it('parses a comma decimal emitted by Android decimal-pad on RU/BE/PL locales', () => {
      expect(parseCoordinate('53,9')).toBe(53.9)
      expect(parseCoordinate('27,561234')).toBeCloseTo(27.561234)
    })

    it('parses a negative value', () => {
      expect(parseCoordinate('-45,5')).toBe(-45.5)
    })

    it('trims surrounding whitespace', () => {
      expect(parseCoordinate('  53.9  ')).toBe(53.9)
    })

    it('returns NaN for empty/garbage', () => {
      expect(Number.isNaN(parseCoordinate(''))).toBe(true)
      expect(Number.isNaN(parseCoordinate('abc'))).toBe(true)
    })
  })

  describe('toggleNumericSign (± button fallback for keyboards without a minus)', () => {
    it('prefixes a minus to an empty field', () => {
      expect(toggleNumericSign('')).toBe('-')
      expect(toggleNumericSign('   ')).toBe('-')
    })

    it('adds a minus to a positive value', () => {
      expect(toggleNumericSign('53.9')).toBe('-53.9')
    })

    it('removes the minus from a negative value', () => {
      expect(toggleNumericSign('-53.9')).toBe('53.9')
    })

    it('preserves the comma decimal separator', () => {
      expect(toggleNumericSign('53,9')).toBe('-53,9')
      expect(toggleNumericSign('-53,9')).toBe('53,9')
    })

    it('trims surrounding whitespace before toggling', () => {
      expect(toggleNumericSign('  53.9  ')).toBe('-53.9')
    })
  })

  describe('parseCoordsPair', () => {
    it('parses the canonical "lat, lng" dot format', () => {
      expect(parseCoordsPair('49.609645, 18.845693')).toEqual({ lat: 49.609645, lng: 18.845693 })
    })

    it('parses European comma-decimal pairs ("53,9, 27,5")', () => {
      expect(parseCoordsPair('53,9, 27,5')).toEqual({ lat: 53.9, lng: 27.5 })
    })

    it('parses comma-decimals separated by whitespace ("53,9 27,5")', () => {
      expect(parseCoordsPair('53,9 27,5')).toEqual({ lat: 53.9, lng: 27.5 })
    })

    it('parses semicolon-separated negatives', () => {
      expect(parseCoordsPair('-53.9;-27.5')).toEqual({ lat: -53.9, lng: -27.5 })
    })

    it('parses integer pairs', () => {
      expect(parseCoordsPair('53, 27')).toEqual({ lat: 53, lng: 27 })
    })

    it('rejects out-of-range latitude', () => {
      expect(parseCoordsPair('91, 27')).toBeNull()
    })

    it('rejects out-of-range longitude', () => {
      expect(parseCoordsPair('53, 181')).toBeNull()
    })

    it('rejects a single value', () => {
      expect(parseCoordsPair('53.9')).toBeNull()
    })

    it('rejects empty input', () => {
      expect(parseCoordsPair('')).toBeNull()
    })
  })
})
