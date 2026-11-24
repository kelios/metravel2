/**
 * #2883 — переводы контента дверец: слияние накладки с RU-источником, валидатор
 * накладок, ответы загадок на всех языках, орфография BE/UK, web-загрузчик накладок
 * (статические JSON в `public/assets/data/advent`, #3487).
 */
import fs from 'node:fs'
import path from 'node:path'

import { applyAdventOverlay } from '@/services/advent/applyOverlay'
import { getAdventCampaign } from '@/services/advent/loadCampaign'
import { buildAdventAnswerChecker } from '@/utils/advent/adventRiddle'
import type { AdventCampaignOverlay } from '@/types/advent'

const { validateAdventOverlay } = require('../../scripts/lib/advent-config-validator.js') as {
  validateAdventOverlay: (overlay: unknown, config: unknown, options?: { locale?: string }) => string[]
}

const LOCALES = ['be', 'uk', 'pl', 'en'] as const
const readOverlay = (locale: string): AdventCampaignOverlay =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/assets/data/advent', `2026.${locale}.json`), 'utf8'))

const config = getAdventCampaign()

describe('applyAdventOverlay', () => {
  it('без накладки возвращает тот же конфиг', () => {
    expect(applyAdventOverlay(config, null)).toBe(config)
    expect(applyAdventOverlay(config, undefined)).toBe(config)
    expect(applyAdventOverlay(config, { locale: 'en', year: 2025, doors: {} })).toBe(config)
  })

  it('подменяет тексты, пустые и отсутствующие оставляет RU, не трогает ссылки и ответы', () => {
    const overlay: AdventCampaignOverlay = {
      locale: 'en',
      year: 2026,
      doors: {
        '2': { gift: { title: 'Hidden places', text: '' }, task: { ctaLabel: 'Pick routes' } },
        '3': { task: { riddle: { questions: [{ question: 'Which town?', options: ['x'] }] } } },
      },
    }
    const merged = applyAdventOverlay(config, overlay)
    const door2 = merged.doors[1]
    expect(door2.gift.title).toBe('Hidden places')
    expect(door2.gift.text).toBe(config.doors[1].gift.text)
    expect(door2.gift.link).toBe(config.doors[1].gift.link)
    expect(door2.task.text).toBe(config.doors[1].task.text)
    expect(door2.task.ctaLabel).toBe('Pick routes')
    expect(door2.task.ctaRoute).toBe(config.doors[1].task.ctaRoute)
    const question = merged.doors[2].task.riddle!.questions[0]
    expect(question.question).toBe('Which town?')
    expect(question.hint).toBe(config.doors[2].task.riddle!.questions[0].hint)
    expect(question.options).toBe(config.doors[2].task.riddle!.questions[0].options)
    expect(question.answer_pattern).toEqual(config.doors[2].task.riddle!.questions[0].answer_pattern)
    expect(merged.doors[0]).toBe(config.doors[0])
  })
})

describe('validateAdventOverlay', () => {
  it.each(LOCALES)('накладка %s полная и согласована с RU-источником', (locale) => {
    expect(validateAdventOverlay(readOverlay(locale), config, { locale })).toEqual([])
  })

  it('ловит чужой день, непереводимое поле, пустой текст, число вариантов и вариант вне answer_pattern', () => {
    const overlay = JSON.parse(JSON.stringify(readOverlay('en'))) as AdventCampaignOverlay
    overlay.doors['99'] = { gift: { title: 'x' } }
    ;(overlay.doors['2'].gift as Record<string, unknown>).link = '/x'
    overlay.doors['4'].gift!.title = '  '
    overlay.doors['6'].task!.riddle!.questions[0].options = ['6', '7']
    overlay.doors['10'].task!.riddle!.questions[0].options![0] = 'Greenland'
    const errors = validateAdventOverlay(overlay, config, { locale: 'en' })
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('doors[99]'),
        expect.stringContaining('doors[2].gift.link'),
        expect.stringContaining('doors[4].gift.title'),
        expect.stringContaining('doors[6].task.riddle.questions[0].options'),
        expect.stringContaining('"Greenland"'),
      ]),
    )
    expect(validateAdventOverlay(readOverlay('pl'), config, { locale: 'en' })).toEqual([expect.stringContaining('locale')])
  })
})

describe('ответы загадок на всех языках', () => {
  it.each(LOCALES)('верные варианты викторин накладки %s засчитываются RU-чекером', (locale) => {
    const merged = applyAdventOverlay(config, readOverlay(locale))
    let checked = 0
    // Основные задания и варианты «Беларусь / Польша» (#3486) проверяются одинаково.
    const tasksOf = (door: (typeof config.doors)[number]) => [door.task, ...(door.variants ?? []).map((variant) => variant.task)]
    merged.doors.forEach((door, doorIndex) => {
      const sourceTasks = tasksOf(config.doors[doorIndex])
      tasksOf(door).forEach((task, taskIndex) => {
        task.riddle?.questions.forEach((question, qIndex) => {
          if (!question.options) return
          const source = sourceTasks[taskIndex].riddle!.questions[qIndex]
          const checker = buildAdventAnswerChecker(source.answer_pattern)
          const correctIndex = source.options!.findIndex((option) => checker(option))
          expect(correctIndex).toBeGreaterThanOrEqual(0)
          expect(checker(question.options[correctIndex])).toBe(true)
          question.options.forEach((option, index) => {
            if (index !== correctIndex) expect(checker(option)).toBe(false)
          })
          checked += 1
        })
      })
    })
    // Все викторины с вариантами, включая варианты «Беларусь / Польша» (v3 по ревью, #3487).
    expect(checked).toBe(17)
  })

  it('свободные загадки принимают написания BE/UK/PL/EN и латиницу', () => {
    const nesvizh = buildAdventAnswerChecker(config.doors[2].task.riddle!.questions[0].answer_pattern)
    ;['Несвиж', 'нясвіж', 'Нясьвіж', 'Несвіж', 'Nieśwież', 'nesvizh', 'Niasvizh'].forEach((answer) => expect(nesvizh(answer)).toBe(true))
    expect(nesvizh('Мир')).toBe(false)
    // Святочная история (дверца 10, v3): ответ «дорожная карта» на всех языках.
    const map = buildAdventAnswerChecker(config.doors[9].task.riddle!.questions[0].answer_pattern)
    ;['Свою дорожную карту', 'Карту', 'Дарожную мапу', 'Дорожню карту', 'Mapę drogową', 'His map'].forEach((answer) => expect(map(answer)).toBe(true))
    expect(map('Свечу')).toBe(false)
  })
})

describe('орфография накладок', () => {
  it('BE без русских букв и, щ, ъ', () => {
    expect(JSON.stringify(readOverlay('be')).match(/[ищъИЩЪ]/g)).toBeNull()
  })
  it('UK без ы, э, ъ, ё', () => {
    expect(JSON.stringify(readOverlay('uk')).match(/[ыэъёЫЭЪЁ]/g)).toBeNull()
  })
})

describe('web-загрузчик накладок', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  it('грузит JSON локали один раз, RU — без запроса', async () => {
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', url), 'utf8')),
    }))
    global.fetch = fetchMock as unknown as typeof fetch
    jest.resetModules()
    const web = require('@/services/advent/campaignOverlay.web') as typeof import('@/services/advent/campaignOverlay.web')
    expect(web.getLoadedAdventOverlay('ru')).toBeNull()
    expect(web.getLoadedAdventOverlay('pl')).toBeUndefined()
    const first = web.loadAdventOverlay('pl')
    expect(web.loadAdventOverlay('pl')).toBe(first)
    const overlay = await first
    expect(overlay?.locale).toBe('pl')
    expect(web.getLoadedAdventOverlay('pl')).toBe(overlay)
    await expect(web.loadAdventOverlay('ru')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/assets/data/advent/2026.pl.json')
  })

  it('чужой или битый JSON не принимается за перевод', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ locale: 'en', year: 2026, doors: {} }) })) as unknown as typeof fetch
    jest.resetModules()
    const web = require('@/services/advent/campaignOverlay.web') as typeof import('@/services/advent/campaignOverlay.web')
    await expect(web.loadAdventOverlay('be')).resolves.toBeNull()
  })
})

describe('правила языка интерфейса в чекере загадок (#2883, ревью-гейт)', () => {
  it('принимает написания, которых нет в списке, через нормализаторы языка', () => {
    const map = buildAdventAnswerChecker(config.doors[9].task.riddle!.questions[0].answer_pattern)
    expect(map('his road map', 'en')).toBe(true)
    const nesvizh = buildAdventAnswerChecker(config.doors[2].task.riddle!.questions[0].answer_pattern)
    expect(nesvizh('Nieswiez', 'pl')).toBe(true)
    expect(nesvizh('Niasviz', 'en')).toBe(true)
    expect(nesvizh('Mir', 'en')).toBe(false)
    expect(nesvizh('', 'en')).toBe(false)
  })

  it('RU-правила действуют и при другом языке интерфейса', () => {
    const nesvizh = buildAdventAnswerChecker(config.doors[2].task.riddle!.questions[0].answer_pattern)
    expect(nesvizh('несвиж', 'pl')).toBe(true)
  })
})

describe('web-загрузчик: сбой загрузки не запоминается', () => {
  it('после ошибки сети локаль остаётся «ещё не загружена» и грузится повторно', async () => {
    const realFetch = global.fetch
    let attempts = 0
    global.fetch = jest.fn(async () => {
      attempts += 1
      if (attempts === 1) return { ok: false, status: 503, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({ locale: 'uk', year: 2026, doors: {} }) }
    }) as unknown as typeof fetch
    jest.resetModules()
    const web = require('@/services/advent/campaignOverlay.web') as typeof import('@/services/advent/campaignOverlay.web')
    await expect(web.loadAdventOverlay('uk')).resolves.toBeNull()
    expect(web.getLoadedAdventOverlay('uk')).toBeUndefined()
    await expect(web.loadAdventOverlay('uk')).resolves.toEqual({ locale: 'uk', year: 2026, doors: {} })
    expect(attempts).toBe(2)
    global.fetch = realFetch
  })
})
