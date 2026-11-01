import campaign from '@/data/advent/2026.json'
import type { AdventCampaignConfig } from '@/types/advent'
import { buildAdventAnswerChecker, checkAdventGeoAnswer } from '@/utils/advent/adventRiddle'

const doors = (campaign as AdventCampaignConfig).doors

describe('advent riddle checker reuses the quest answer checker (#2862)', () => {
  const nesvizh = buildAdventAnswerChecker(doors[2].task.riddle!.questions[0].answer_pattern)

  it('accepts spelling variants: case, extra spaces, Belarusian and Latin forms', () => {
    expect(nesvizh('Несвиж')).toBe(true)
    expect(nesvizh('несвиж')).toBe(true)
    expect(nesvizh('  НЕСВИЖ  ')).toBe(true)
    expect(nesvizh('Нясвіж')).toBe(true)
    expect(nesvizh('nesvizh')).toBe(true)
  })

  it('rejects wrong and empty answers', () => {
    expect(nesvizh('Мир')).toBe(false)
    expect(nesvizh('')).toBe(false)
    expect(nesvizh('   ')).toBe(false)
  })

  it('checks numeric exact answers of quizzes', () => {
    const christmas = buildAdventAnswerChecker({ type: 'exact', value: '7' })
    expect(christmas('7')).toBe(true)
    expect(christmas(' 7 ')).toBe(true)
    expect(christmas('6')).toBe(false)
  })

  it('normalizes ё/е in exact_any dictionaries', () => {
    const checker = buildAdventAnswerChecker({ type: 'exact_any', value: ['Зелёный'] })
    expect(checker('зеленый')).toBe(true)
  })

  it('every configured riddle accepts its own first dictionary variant', () => {
    doors
      .filter((door) => door.task.type === 'riddle')
      .flatMap((door) => door.task.riddle!.questions)
      .forEach((question) => {
        const checker = buildAdventAnswerChecker(question.answer_pattern)
        const first = Array.isArray(question.answer_pattern.value) ? question.answer_pattern.value[0] : question.answer_pattern.value
        expect(checker(first)).toBe(true)
        expect(checker('заведомо неверный ответ 123')).toBe(false)
      })
  })
})

describe('advent geo check', () => {
  const target = doors[8].task.geo!

  it('hits inside the radius and misses outside it', () => {
    expect(checkAdventGeoAnswer(target, { lat: target.lat + 0.01, lng: target.lng }).hit).toBe(true)
    const miss = checkAdventGeoAnswer(target, { lat: 53.9, lng: 27.56 })
    expect(miss.hit).toBe(false)
    expect(miss.distanceMeters).toBeGreaterThan(50_000)
  })
})
