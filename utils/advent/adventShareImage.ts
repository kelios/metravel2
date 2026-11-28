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

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean)
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
  ctx.font = `bold ${compact ? 64 : 85}px Georgia, serif`
  wrapLines(ctx, spec.title, width, 3).forEach((line) => {
    ctx.fillText(line, PAD, y)
    y += compact ? 74 : 90
  })

  if (spec.hero) {
    y += 24
    ctx.font = `800 ${compact ? 120 : 180}px ${FONT}`
    ctx.fillText(spec.hero, PAD, y)
    y += compact ? 136 : 200
  }

  if (spec.subtitle) {
    y += 12
    ctx.font = `400 ${compact ? 30 : 40}px ${FONT}`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    wrapLines(ctx, spec.subtitle, width, compact ? 2 : 3).forEach((line) => {
      ctx.fillText(line, PAD, y)
      y += compact ? 40 : 54
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
