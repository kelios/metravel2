/** @jest-environment jsdom */
import { hasPrintedPageOverflow } from '@/workers/book-renderer/measurement'

jest.mock('playwright', () => ({ chromium: { launch: jest.fn() } }))

const rectangle = (right: number, bottom: number) => ({
  x: 0, y: 0, left: 0, top: 0, width: right, height: bottom, right, bottom, toJSON: () => ({}),
})

describe('bounded print DOM visibility', () => {
  afterEach(() => { jest.restoreAllMocks(); document.body.innerHTML = '' })

  function fixture(overflowY: string, textRight = 90, textBottom = 100): void {
    document.body.innerHTML = '<section class="pdf-page"><div id="caption">Full source caption</div></section>'
    const caption = document.querySelector<HTMLElement>('#caption')!
    caption.style.overflowY = overflowY
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.id === 'caption' ? rectangle(100, 80) : rectangle(200, 1000)
    })
    jest.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: jest.fn(), getClientRects: () => [rectangle(textRight, textBottom)],
    } as unknown as Range)
  }

  it('rejects a direct div caption clipped inside a page even though the full source text is present', () => {
    fixture('hidden')
    expect(hasPrintedPageOverflow(100)).toBe(true)
    document.querySelector<HTMLElement>('#caption')!.style.overflowY = 'visible'
    expect(hasPrintedPageOverflow(100)).toBe(false)
  })

  it('rejects horizontal text clipping and text beyond the printable page', () => {
    fixture('visible', 150, 70)
    document.querySelector<HTMLElement>('#caption')!.style.overflowX = 'hidden'
    expect(hasPrintedPageOverflow(100)).toBe(true)
    document.querySelector<HTMLElement>('#caption')!.style.overflowX = 'visible'
    expect(hasPrintedPageOverflow(100)).toBe(false)
    jest.mocked(document.createRange).mockReturnValue({
      selectNodeContents: jest.fn(), getClientRects: () => [rectangle(90, 1200)],
    } as unknown as Range)
    expect(hasPrintedPageOverflow(100)).toBe(true)
  })

  it('accepts a deliberate one-line ellipsis header while still rejecting other horizontal clipping', () => {
    fixture('visible', 150, 70)
    const caption = document.querySelector<HTMLElement>('#caption')!
    caption.style.overflowX = 'hidden'
    caption.style.textOverflow = 'ellipsis'
    caption.style.whiteSpace = 'nowrap'
    expect(hasPrintedPageOverflow(100)).toBe(false)
    caption.style.whiteSpace = 'normal'
    expect(hasPrintedPageOverflow(100)).toBe(true)
    caption.style.whiteSpace = 'nowrap'
    caption.style.textOverflow = 'clip'
    expect(hasPrintedPageOverflow(100)).toBe(true)
    // Vertical clipping is never a deliberate truncation.
    caption.style.textOverflow = 'ellipsis'
    caption.style.overflowY = 'hidden'
    jest.mocked(document.createRange).mockReturnValue({
      selectNodeContents: jest.fn(), getClientRects: () => [rectangle(90, 95)],
    } as unknown as Range)
    expect(hasPrintedPageOverflow(100)).toBe(true)
  })

  it('enforces the DOM budget before scanning source text', () => {
    fixture('visible')
    expect(() => hasPrintedPageOverflow(1)).toThrow('WORKER_DOM_BUDGET_EXCEEDED')
    expect(document.createRange).not.toHaveBeenCalled()
  })

  it('rejects an opaque caption overlay that covers its entire source photo frame', () => {
    document.body.innerHTML = '<section class="pdf-page"><div id="frame"><figcaption class="book-gallery-caption" style="position:absolute">Source caption</figcaption></div></section>'
    let captionHeight = 80
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.id === 'frame') return rectangle(100, 80)
      if (this.tagName === 'FIGCAPTION') return rectangle(100, captionHeight)
      return rectangle(200, 1000)
    })
    jest.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: jest.fn(), getClientRects: () => [rectangle(90, 15)],
    } as unknown as Range)
    expect(hasPrintedPageOverflow(100)).toBe(true)
    captionHeight = 20
    expect(hasPrintedPageOverflow(100)).toBe(false)
  })
})
