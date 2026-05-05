import { hasPetCompanion } from '@/components/listTravel/travelListItemHelpers'

describe('hasPetCompanion', () => {
  it('returns false for empty input', () => {
    expect(hasPetCompanion(undefined)).toBe(false)
    expect(hasPetCompanion(null)).toBe(false)
    expect(hasPetCompanion([])).toBe(false)
    expect(hasPetCompanion('')).toBe(false)
  })

  it('detects dog/cat keywords in Russian', () => {
    expect(hasPetCompanion(['Собака'])).toBe(true)
    expect(hasPetCompanion(['С собакой'])).toBe(true)
    expect(hasPetCompanion(['Кот'])).toBe(true)
    expect(hasPetCompanion(['С котом'])).toBe(true)
    expect(hasPetCompanion(['Кошка'])).toBe(true)
    expect(hasPetCompanion(['С питомцем'])).toBe(true)
    expect(hasPetCompanion(['Животные'])).toBe(true)
  })

  it('detects pet keywords in English', () => {
    expect(hasPetCompanion(['dog'])).toBe(true)
    expect(hasPetCompanion(['cat'])).toBe(true)
    expect(hasPetCompanion(['pet'])).toBe(true)
  })

  it('returns false for non-pet companions', () => {
    expect(hasPetCompanion(['Один'])).toBe(false)
    expect(hasPetCompanion(['С друзьями'])).toBe(false)
    expect(hasPetCompanion(['Семья', 'Дети'])).toBe(false)
    expect(hasPetCompanion(['Пара'])).toBe(false)
  })

  it('handles array of objects with name field', () => {
    expect(hasPetCompanion([{ name: 'Собака' }, { name: 'Семья' }])).toBe(true)
    expect(hasPetCompanion([{ name: 'Семья' }])).toBe(false)
  })

  it('handles mixed input types', () => {
    expect(hasPetCompanion(['Один', 'С котом'])).toBe(true)
    expect(hasPetCompanion('С собакой')).toBe(true)
  })
})
