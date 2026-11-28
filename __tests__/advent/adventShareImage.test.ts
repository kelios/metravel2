import fs from 'node:fs'
import path from 'node:path'
import { getAdventCampaign } from '@/services/advent/loadCampaign'
import { applyAdventOverlay } from '@/services/advent/applyOverlay'
import type { AdventCampaignOverlay } from '@/types/advent'
import { ADVENT_CARD_HEIGHT, ADVENT_CARD_WIDTH, drawAdventCard, type AdventCardSpec } from '@/utils/advent/adventShareImage'

const artwork = {} as HTMLImageElement
const createRecordingCanvas = () => {
  const texts: { text: string; x: number; y: number; size: number; baseline: string }[] = []
  const tiles: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: 'top',
    textAlign: 'left',
    createLinearGradient: () => ({ addColorStop: jest.fn() }),
    drawImage: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    fill: jest.fn(),
    rect: jest.fn(),
    roundRect: (x: number, y: number, w: number, h: number) => tiles.push({ x, y, w, h }),
    fillText: (text: string, x: number, y: number) => {
      texts.push({ text, x, y, size: Number(ctx.font.match(/([\d.]+)px/)?.[1]), baseline: ctx.textBaseline })
    },
    measureText: (text: string) => ({ width: text.length * Number(ctx.font.match(/([\d.]+)px/)?.[1]) * 0.55 }),
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
  return { canvas, ctx, texts, tiles }
}

it('requires the illustration before drawing any export content', () => {
  const { canvas, ctx } = createRecordingCanvas()
  expect(drawAdventCard(canvas, { eyebrow: 'Адвент', title: 'Мой адвент', stats: [] })).toBe(false)
  expect(ctx.fillRect).not.toHaveBeenCalled()
})

it('exports a localized title and footer over the full illustration', () => {
  const { canvas, ctx, texts, tiles } = createRecordingCanvas()
  expect(drawAdventCard(canvas, {
    eyebrow: 'Adwent', title: 'Legenda dróg', subtitle: 'Mój tytuł', stats: [], footer: 'metravel.by/advent',
  }, artwork)).toBe(true)
  expect(ctx.drawImage).toHaveBeenCalledWith(artwork, 0, 0, ADVENT_CARD_WIDTH, ADVENT_CARD_HEIGHT)
  expect(texts.map(({ text }) => text)).toEqual(['ADWENT', 'Legenda dróg', 'Mój tytuł', 'metravel.by/advent'])
  expect(tiles).toHaveLength(0)
  expect(ctx.fillRect).toHaveBeenCalledTimes(1)
})

it('keeps actual progress readable without drawing schematic windows', () => {
  const { canvas, texts, tiles } = createRecordingCanvas()
  drawAdventCard(canvas, { eyebrow: 'Адвент', title: 'Мой адвент', hero: '1/24', subtitle: 'Серия день в день: 1', stats: [] }, artwork)
  expect(texts.map(({ text }) => text)).toContain('1/24')
  expect(tiles).toHaveLength(0)
})

it.each([
  'Итоги года путешественника с самыми длинными историями',
  'Падвядзенне вынікаў падарожжаў за апошні год',
  'Підсумки року мандрівника та найдовші маршрути',
  'Podsumowanie podróży i najpiękniejszych wspomnień roku',
  'Your year of travel and the memories along the way',
])('fits eight statistics and long text above the footer — %s', (title) => {
  const { canvas, texts, tiles } = createRecordingCanvas()
  const spec: AdventCardSpec = {
    eyebrow: 'Адвент-календарь путешественника',
    title,
    subtitle: 'Беларусь · Польша · Соединённое Королевство · Соединённые Штаты',
    stats: Array.from({ length: 8 }, () => ({ value: '12 345', label: 'Самый длинный маршрут путешествия' })),
  }
  drawAdventCard(canvas, spec, artwork)
  expect(tiles).toHaveLength(8)
  expect(Math.max(...tiles.map(({ y, h }) => y + h))).toBeLessThanOrEqual(1198)
  const footer = texts.at(-1)!
  expect(footer.text).toBe('metravel.by/advent')
  expect(footer.baseline).toBe('bottom')
  expect(texts.slice(0, -1).every(({ y, size }) => y + size < footer.y - footer.size)).toBe(true)
})

it.each(['ru', 'be', 'uk', 'pl', 'en'])('preserves every character of the longest actual fortune in %s', (locale) => {
  const overlay: AdventCampaignOverlay | undefined = locale === 'ru' ? undefined : JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/assets/data/advent', `2026.${locale}.json`), 'utf8'),
  )
  const campaign = applyAdventOverlay(getAdventCampaign(), overlay)
  const fortunes = campaign.doors.flatMap((door) => [door.task, ...(door.variants ?? []).map(({ task }) => task)])
    .flatMap((task) => task.game?.kind === 'fortune' ? task.game.items : [])
  const fortune = fortunes.reduce((longest, candidate) => candidate.length > longest.length ? candidate : longest, '')
  expect(fortune.length).toBeGreaterThan(100)
  const resources = require(`@/i18n/locales/${locale}/static/advent_static`).adventStaticResources
  const subtitle = resources['game.fortune.shareSubtitle']
  const { canvas, texts } = createRecordingCanvas()
  expect(drawAdventCard(canvas, { eyebrow: 'ADVENT', title: fortune, subtitle, stats: [] }, artwork)).toBe(true)
  const content = texts.slice(1, -1)
  expect(content.map(({ text }) => text).join(' ').replace(/\s/g, '')).toBe((fortune + subtitle).replace(/\s/g, ''))
  expect(content.every(({ text, x, size }) => x + text.length * size * 0.55 <= ADVENT_CARD_WIDTH - 88)).toBe(true)
  const lastTitleCharacter = fortune.replace(/\s/g, '').length
  let drawn = 0
  const titleLines = content.filter(({ text }) => {
    const inTitle = drawn < lastTitleCharacter
    drawn += text.replace(/\s/g, '').length
    return inTitle
  })
  expect(titleLines.at(-1)!.y + titleLines.at(-1)!.size).toBeLessThanOrEqual(88 + 40 + 16 + 320)
  expect(titleLines[0].size).toBeGreaterThanOrEqual(44)
})

it('wraps an unusually long unbroken title without clipping characters', () => {
  const title = 'W'.repeat(80)
  const { canvas, texts } = createRecordingCanvas()
  expect(drawAdventCard(canvas, { eyebrow: 'ADVENT', title, stats: [] }, artwork)).toBe(true)
  expect(texts.slice(1, -1).map(({ text }) => text).join('')).toBe(title)
  expect(texts.slice(1, -1).every(({ text, x, size }) => x + text.length * size * 0.55 <= ADVENT_CARD_WIDTH - 88)).toBe(true)
})
