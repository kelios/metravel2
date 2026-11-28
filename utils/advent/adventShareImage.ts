// Canvas adds localized text and personal statistics over the prepared winter illustration.
// Rendering remains synchronous to preserve Safari's share gesture.
import { adventFooterUrl } from '@/utils/advent/adventShare'

export const ADVENT_CARD_WIDTH = 1080
export const ADVENT_CARD_HEIGHT = 1350

export type AdventCardStat = { value: string; label: string }

export type AdventCardSpec = {
  eyebrow: string
  title: string
  hero?: string
  subtitle?: string
  stats: AdventCardStat[]
  footer?: string
}

const FONT = '"Helvetica Neue", Arial, sans-serif'
const PAD = 88
const CONTENT_BOTTOM = ADVENT_CARD_HEIGHT - PAD - 64

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = Infinity): string[] => {
  const words = text.split(/\s+/).filter(Boolean).flatMap((word) => {
    const pieces: string[] = []
    let piece = ''
    for (const character of word) {
      if (piece && ctx.measureText(piece + character).width > maxWidth) {
        pieces.push(piece)
        piece = character
      } else piece += character
    }
    if (piece) pieces.push(piece)
    return pieces
  })
  const lines: string[] = []
  let current = ''
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
  })
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:!?]?$/, '')}…`
  return kept
}

/** Selects the largest readable size that preserves the entire paragraph in its text box. */
const fitParagraph = (
  ctx: CanvasRenderingContext2D, text: string, width: number, height: number,
  font: (size: number) => string, maximumSize: number, minimumSize: number,
) => {
  for (let size = maximumSize; size >= minimumSize; size -= 1) {
    ctx.font = font(size)
    const lines = wrapLines(ctx, text, width)
    const lineHeight = size * 1.1
    if (lines.length * lineHeight <= height) return { lines, lineHeight }
  }
  return null
}

/** Exports require a prepared illustration, so a failed load cannot produce an old placeholder. */
export const drawAdventCard = (canvas: HTMLCanvasElement, spec: AdventCardSpec, artwork?: HTMLImageElement): boolean => {
  if (!artwork) return false
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  canvas.width = ADVENT_CARD_WIDTH
  canvas.height = ADVENT_CARD_HEIGHT

  ctx.drawImage(artwork, 0, 0, ADVENT_CARD_WIDTH, ADVENT_CARD_HEIGHT)
  const shade = ctx.createLinearGradient(0, 0, 0, ADVENT_CARD_HEIGHT)
  shade.addColorStop(0, 'rgba(3, 22, 35, 0.72)')
  shade.addColorStop(0.42, 'rgba(3, 22, 35, 0.30)')
  shade.addColorStop(0.56, 'rgba(3, 22, 35, 0)')
  shade.addColorStop(0.84, 'rgba(3, 22, 35, 0)')
  shade.addColorStop(1, 'rgba(3, 22, 35, 0.80)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, ADVENT_CARD_WIDTH, ADVENT_CARD_HEIGHT)

  const width = ADVENT_CARD_WIDTH - PAD * 2
  const stats = spec.stats.slice(0, 8)
  const compact = stats.length > 0
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffdf9e'
  ctx.font = `600 29px ${FONT}`
  let y = PAD
  wrapLines(ctx, spec.eyebrow.toUpperCase(), width, 2).forEach((line) => {
    ctx.fillText(line, PAD, y)
    y += 40
  })

  y += 16
  ctx.fillStyle = '#ffffff'
  const title = fitParagraph(ctx, spec.title, width, compact ? 222 : 320, (size) => `bold ${size}px Georgia, serif`, compact ? 64 : 85, 44)
  if (!title) return false
  title.lines.forEach((line) => {
    ctx.fillText(line, PAD, y)
    y += title.lineHeight
  })

  if (spec.hero) {
    y += 24
    ctx.font = `800 ${compact ? 120 : 180}px ${FONT}`
    ctx.fillText(spec.hero, PAD, y)
    y += compact ? 136 : 200
  }

  if (spec.subtitle) {
    y += 12
    const subtitle = fitParagraph(ctx, spec.subtitle, width, compact ? 80 : 162, (size) => `400 ${size}px ${FONT}`, compact ? 30 : 40, compact ? 24 : 28)
    if (!subtitle) return false
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    subtitle.lines.forEach((line) => {
      ctx.fillText(line, PAD, y)
      y += subtitle.lineHeight
    })
  }

  if (compact) {
    y += 28
    const gap = 20
    const rows = Math.ceil(stats.length / 2)
    const tileW = (width - gap) / 2
    const tileH = Math.min(150, (CONTENT_BOTTOM - y - gap * (rows - 1)) / rows)
    const valueSize = Math.min(44, tileH * 0.32)
    const labelSize = Math.min(24, tileH * 0.18)
    const inset = Math.min(20, tileH * 0.12)
    stats.forEach((stat, index) => {
      const x = PAD + (index % 2) * (tileW + gap)
      const top = y + Math.floor(index / 2) * (tileH + gap)
      ctx.fillStyle = 'rgba(3, 22, 35, 0.85)'
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, top, tileW, tileH, 20)
      else ctx.rect(x, top, tileW, tileH)
      ctx.fill()
      ctx.fillStyle = '#ffdf9e'
      ctx.font = `800 ${valueSize}px ${FONT}`
      ctx.fillText(wrapLines(ctx, stat.value, tileW - inset * 2, 1)[0] ?? '', x + inset, top + inset)
      ctx.fillStyle = '#ffffff'
      ctx.font = `500 ${labelSize}px ${FONT}`
      wrapLines(ctx, stat.label, tileW - inset * 2, 2).forEach((line, lineIndex) => {
        ctx.fillText(line, x + inset, top + inset + valueSize + 8 + lineIndex * labelSize * 1.15)
      })
    })
  }

  ctx.fillStyle = '#fff4d9'
  ctx.font = `700 38px ${FONT}`
  ctx.textBaseline = 'bottom'
  ctx.fillText(spec.footer ?? adventFooterUrl(), PAD, ADVENT_CARD_HEIGHT - PAD + 20)
  return true
}

const dataUrlToPngBlob = (dataUrl: string): Blob | null => {
  const [header, base64] = dataUrl.split(',')
  if (header !== 'data:image/png;base64' || !base64 || typeof atob !== 'function') return null
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: 'image/png' })
}

export function renderAdventCardPng(spec: AdventCardSpec, artwork?: HTMLImageElement): Blob | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  try {
    if (!drawAdventCard(canvas, spec, artwork)) return null
    return dataUrlToPngBlob(canvas.toDataURL('image/png'))
  } catch {
    return null
  }
}
