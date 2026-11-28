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
