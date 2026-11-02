import { ADVENT_CARD_HEIGHT, ADVENT_CARD_WIDTH, drawAdventCard } from '@/utils/advent/adventShareImage'

// Карточка «Мой адвент N/24» при малом N была наполовину пустой (#2867/#2868
// ревью): сетка дверец заполняет середину и не заходит на подпись внизу.

type Cell = { x: number; y: number; size: number; fill: string }

const createRecordingCanvas = () => {
  const cells: Cell[] = []
  let fillStyle = ''
  const ctx = {
    set fillStyle(value: string) {
      fillStyle = value
    },
    get fillStyle() {
      return fillStyle
    },
    font: '',
    textBaseline: 'top',
    textAlign: 'left',
    createLinearGradient: () => ({ addColorStop: jest.fn() }),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    rect: jest.fn(),
    roundRect: (x: number, y: number, w: number, h: number) => {
      if (w === h) cells.push({ x, y, size: w, fill: fillStyle })
    },
    fillText: jest.fn(),
    measureText: (text: string) => ({ width: text.length * 20 }),
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
  return { canvas, cells }
}

describe('drawAdventCard progress grid', () => {
  it('draws 24 door cells with N highlighted, centred between the text and the footer', () => {
    const { canvas, cells } = createRecordingCanvas()
    const drawn = drawAdventCard(canvas, {
      eyebrow: 'Адвент-календарь путешественника',
      title: 'Мой адвент',
      hero: '1/24',
      subtitle: 'Серия день в день: 1',
      stats: [],
      progress: { done: 1, total: 24 },
    })
    expect(drawn).toBe(true)
    expect(cells).toHaveLength(24)
    const highlighted = cells.filter((cell) => cell.fill === cells[0].fill)
    expect(highlighted).toHaveLength(1)
    const top = Math.min(...cells.map((cell) => cell.y))
    const bottom = Math.max(...cells.map((cell) => cell.y + cell.size))
    const left = Math.min(...cells.map((cell) => cell.x))
    const right = Math.max(...cells.map((cell) => cell.x + cell.size))
    // Сетка занимает заметную часть высоты и не заходит на подпись внизу.
    expect(bottom - top).toBeGreaterThan(ADVENT_CARD_HEIGHT * 0.35)
    expect(bottom).toBeLessThan(ADVENT_CARD_HEIGHT - 88 - 38)
    expect(Math.round(left)).toBe(Math.round(ADVENT_CARD_WIDTH - right))
  })

  it('clamps N to the grid and draws nothing extra without progress', () => {
    const full = createRecordingCanvas()
    drawAdventCard(full.canvas, { eyebrow: 'e', title: 't', stats: [], progress: { done: 30, total: 24 } })
    expect(full.cells).toHaveLength(24)
    expect(new Set(full.cells.map((cell) => cell.fill)).size).toBe(1)

    const plain = createRecordingCanvas()
    drawAdventCard(plain.canvas, { eyebrow: 'e', title: 't', stats: [] })
    expect(plain.cells).toHaveLength(0)
  })
})
