import { resolveAuthIntentCopy, resolveAuthIntentGroup } from '@/utils/authIntentCopy'

describe('authIntentCopy (#2898)', () => {
  it('groups guest action intents and ignores page-level ones', () => {
    expect(resolveAuthIntentGroup('calendar')).toBe('calendar')
    expect(resolveAuthIntentGroup(['plan-trip'])).toBe('calendar')
    expect(resolveAuthIntentGroup('save-point')).toBe('favorite')
    expect(resolveAuthIntentGroup('share-trip')).toBe('author')
    expect(resolveAuthIntentGroup('build-pdf')).toBe('book')
    expect(resolveAuthIntentGroup('profile')).toBeNull()
    expect(resolveAuthIntentGroup(undefined)).toBeNull()
  })

  it('names the item only where it makes sense, otherwise uses the group wording', () => {
    expect(resolveAuthIntentCopy('favorite', 'Нарочь')?.title).toBe('Добавьте «Нарочь» в «Хочу поехать»')
    expect(resolveAuthIntentCopy('favorite')?.title).toBe('Сохраните в «Хочу поехать»')
    expect(resolveAuthIntentCopy('share-trip', 'Нарочь')?.title).toBe('Расскажите о своей поездке')
    expect(resolveAuthIntentCopy('menu', 'Нарочь')).toBeNull()
  })
})
