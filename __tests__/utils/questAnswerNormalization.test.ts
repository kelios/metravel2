// #2196: правило нормализации ответа выбирается по языку контента квеста.
// Сценарии требования «Ответ принимается на языке перевода и на языке
// источника» из `openspec/changes/add-quest-content-localization`.
import fs from 'fs'
import path from 'path'

import { SUPPORTED_LOCALES } from '@/i18n/config'
import { buildAnswerChecker } from '@/utils/questAdapters'
import { evaluateQuestAnswer } from '@/utils/questAnswerEvaluation'
import {
  QUEST_ANSWER_NORMALIZERS,
  UNIVERSAL_QUEST_ANSWER_NORMALIZER,
  normalize,
  normalizeQuestAnswer,
  resolveQuestAnswerNormalizer,
} from '@/utils/questAnswerNormalization'

const exactAny = (...variants: string[]) => buildAnswerChecker('exact_any', JSON.stringify(variants))

describe('реестр нормализаторов', () => {
  it('ключи реестра — только локали из SUPPORTED_LOCALES', () => {
    for (const key of Object.keys(QUEST_ANSWER_NORMALIZERS)) {
      expect(SUPPORTED_LOCALES).toContain(key)
    }
  })

  it('каждая локаль из SUPPORTED_LOCALES разрешается в нормализатор', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(typeof resolveQuestAnswerNormalizer(locale).normalize).toBe('function')
    }
  })

  it('локаль без записи получает универсальное правило, регион отбрасывается', () => {
    expect(resolveQuestAnswerNormalizer('de')).toBe(UNIVERSAL_QUEST_ANSWER_NORMALIZER)
    expect(resolveQuestAnswerNormalizer('cs-CZ')).toBe(UNIVERSAL_QUEST_ANSWER_NORMALIZER)
    expect(resolveQuestAnswerNormalizer('pl-PL')).toBe(QUEST_ANSWER_NORMALIZERS.pl)
    expect(resolveQuestAnswerNormalizer(undefined)).toBe(QUEST_ANSWER_NORMALIZERS.ru)
  })

  it('ru и be — прежнее правило без изменений', () => {
    expect(normalizeQuestAnswer('Белый Орёл!', 'ru')).toBe(normalize('Белый Орёл!'))
    expect(normalizeQuestAnswer('Ад Куль', 'be')).toBe('от куль')
  })

  it('pl снимает диакритику и ł, en — ещё и ведущий артикль, uk — апострофы и ґ', () => {
    expect(normalizeQuestAnswer('Orzeł Biały', 'pl')).toBe('orzel bialy')
    expect(normalizeQuestAnswer('Żółć', 'pl')).toBe('zolc')
    expect(normalizeQuestAnswer('The Eagle', 'en')).toBe('eagle')
    expect(normalizeQuestAnswer('Café', 'en')).toBe('cafe')
    expect(normalizeQuestAnswer('a', 'en')).toBe('a')
    expect(normalizeQuestAnswer('пам’ятка', 'uk')).toBe(normalizeQuestAnswer("пам'ятка", 'uk'))
    expect(normalizeQuestAnswer('ґанок', 'uk')).toBe('ганок')
    expect(normalizeQuestAnswer('  Straße  ', 'de')).toBe('strasse')
  })
})

describe('ответ принимается на языке перевода и на языке источника', () => {
  const eagle = exactAny('орёл', 'белый орёл', 'orzeł', 'eagle')

  it('квест на pl принимает ответ без диакритики', () => {
    expect(eagle('orzel', 'pl')).toBe(true)
    expect(eagle('Orzeł', 'pl')).toBe(true)
  })

  it('квест на en принимает ответ с артиклем', () => {
    expect(eagle('the eagle', 'en')).toBe(true)
    expect(eagle('an eagle', 'en')).toBe(true)
  })

  it('русский вариант принимается в квесте на любом языке — по правилу источника', () => {
    for (const locale of [...SUPPORTED_LOCALES, 'de']) {
      expect(eagle('Орел', locale)).toBe(true)
      expect(eagle('белый орёл', locale)).toBe(true)
      // Морфология источника (#1631): «снаряд» — словоформа «снаряды».
      expect(exactAny('снаряды')('снаряд', locale)).toBe(true)
    }
  })

  it('неверный ответ отклоняется на любом языке', () => {
    for (const locale of [...SUPPORTED_LOCALES, 'de']) {
      expect(eagle('дракон', locale)).toBe(false)
      expect(eagle('dragon', locale)).toBe(false)
    }
  })

  it('русский квест не меняет поведения: правило pl к нему не применяется', () => {
    expect(eagle('orzel')).toBe(false)
    expect(eagle('orzel', 'ru')).toBe(false)
    expect(eagle('the eagle', 'ru')).toBe(false)
  })

  it('exact: эталон сверяется под правилом локали контента', () => {
    const checker = buildAnswerChecker('exact', 'Kraków')
    expect(checker('krakow', 'pl')).toBe(true)
    expect(checker('krakow', 'ru')).toBe(false)
    expect(buildAnswerChecker('exact', '1410')('1410', 'en')).toBe(true)
  })
})

describe('evaluateQuestAnswer читает локаль контента из шага', () => {
  const answer = exactAny('orzeł')

  it('без contentLocale — ru', () => {
    expect(evaluateQuestAnswer({ answer, inputType: 'text' }, 'orzel').ok).toBe(false)
  })

  it('contentLocale шага выбирает правило', () => {
    expect(evaluateQuestAnswer({ answer, inputType: 'text', contentLocale: 'pl' }, 'Orzel').ok).toBe(true)
  })
})

describe('второго списка языков в коде проверки нет', () => {
  it('чекер и точка оценки не перечисляют локали сами', () => {
    for (const file of ['utils/questAdapters.ts', 'utils/questAnswerEvaluation.ts']) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
      expect(source).not.toMatch(/['"](be|uk|pl|en)['"]/)
    }
  })
})
