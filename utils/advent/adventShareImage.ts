// Картинки для шеринга адвента (#2868): «Мой адвент N/24» и «Итоги года».
// Рисуются локально на canvas браузера — серверного рендера OG для них нет
// (вне scope #2865). Native картинку не рисует: там шеринг идёт системным
// share sheet со ссылкой (`utils/advent/adventShare.ts`).
//
// Цвета — палитра сезонной темы `christmas` (светлая): картинка уходит в
// соцсети и не зависит от темы того, кто её сохранил.

import { getSeasonalThemePalette } from '@/constants/seasonalThemePalettes'
import { adventFooterUrl } from '@/utils/advent/adventShare'

export const ADVENT_CARD_WIDTH = 1080
export const ADVENT_CARD_HEIGHT = 1350

export type AdventCardStat = { value: string; label: string }

export type AdventCardSpec = {
  /** Мелкая строка над заголовком: «Адвент-календарь путешественника». */
  eyebrow: string
  title: string
  /** Крупное число в центре («12/24»); у итогов года отсутствует. */
  hero?: string
  subtitle?: string
  stats: AdventCardStat[]
  /**
   * Сетка дверец «N из total» под заголовком (карточка прогресса): заполняет
   * середину при любом N, иначе при малом N картинка наполовину пустая.
   */
  progress?: { done: number; total: number }
  /** Подпись внизу; по умолчанию адрес `/advent` без протокола. */
  footer?: string
  /**
   * Ночной дом с окнами внизу карточки (#3482): открытка и итоги года — тот же
   * дом, что на странице, а не голый градиент. `lit` — сколько окон горит.
   */
  house?: { lit: number }
}

const FONT = '"Helvetica Neue", Arial, sans-serif'

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
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

/** Детерминированные «снежинки»: одна и та же картинка при одинаковых данных. */
const drawSnow = (ctx: CanvasRenderingContext2D) => {
  let seed = 2026
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
  for (let index = 0; index < 90; index += 1) {
    const radius = 2 + next() * 5
    ctx.beginPath()
    ctx.arc(next() * ADVENT_CARD_WIDTH, next() * ADVENT_CARD_HEIGHT, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

const PROGRESS_COLUMNS = 6
const PROGRESS_GAP = 20

/**
 * Сетка дверец: открытые — золотые, остальные — полупрозрачные. Клетка
 * вписывается и по ширине, и по высоте до подписи внизу; сетка центрируется.
 */
const drawProgressGrid = (
  ctx: CanvasRenderingContext2D,
  progress: { done: number; total: number },
  area: { left: number; top: number; width: number; bottom: number },
  colors: { done: string; rest: string },
) => {
  const total = Math.max(0, Math.floor(progress.total))
  if (total === 0) return
  const done = Math.min(total, Math.max(0, Math.floor(progress.done)))
  const columns = Math.min(PROGRESS_COLUMNS, total)
  const rows = Math.ceil(total / columns)
  const byWidth = (area.width - PROGRESS_GAP * (columns - 1)) / columns
  const byHeight = (area.bottom - area.top - PROGRESS_GAP * (rows - 1)) / rows
  const cell = Math.floor(Math.min(byWidth, byHeight))
  if (cell <= 0) return
  const gridW = cell * columns + PROGRESS_GAP * (columns - 1)
  const gridH = cell * rows + PROGRESS_GAP * (rows - 1)
  const left = area.left + (area.width - gridW) / 2
  const top = area.top + (area.bottom - area.top - gridH) / 2
  for (let index = 0; index < total; index += 1) {
    const x = left + (index % columns) * (cell + PROGRESS_GAP)
    const y = top + Math.floor(index / columns) * (cell + PROGRESS_GAP)
    ctx.fillStyle = index < done ? colors.done : colors.rest
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, cell, cell, Math.round(cell / 5))
    else ctx.rect(x, y, cell, cell)
    ctx.fill()
  }
}

const HOUSE_COLUMNS = 4
const HOUSE_ROWS = 6

/**
 * Силуэт дома-календаря: стена, крыша со снегом, труба и 24 окна — горящие
 * золотом и тёмные. Детерминированно, без загрузки картинок: canvas остаётся
 * синхронным, и `navigator.share` не теряет жест пользователя.
 */
const drawHouse = (
  ctx: CanvasRenderingContext2D,
  area: { centerX: number; bottom: number; width: number },
  lit: number,
  colors: { wall: string; roof: string; snow: string; window: string; dark: string },
) => {
  const wallW = area.width
  const wallH = Math.round(wallW * 1.05)
  const left = area.centerX - wallW / 2
  const top = area.bottom - wallH
  const roofH = Math.round(wallW * 0.42)
  // Труба за крышей.
  ctx.fillStyle = colors.roof
  ctx.fillRect(left + wallW * 0.7, top - roofH * 0.85, wallW * 0.09, roofH * 0.6)
  // Крыша и снег на ней.
  ctx.beginPath()
  ctx.moveTo(left - wallW * 0.08, top)
  ctx.lineTo(area.centerX, top - roofH)
  ctx.lineTo(left + wallW * 1.08, top)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = colors.snow
  ctx.beginPath()
  ctx.moveTo(left - wallW * 0.08, top)
  ctx.lineTo(area.centerX, top - roofH)
  ctx.lineTo(left + wallW * 1.08, top)
  ctx.lineTo(left + wallW * 1.02, top + 10)
  ctx.lineTo(area.centerX, top - roofH + 18)
  ctx.lineTo(left - wallW * 0.02, top + 10)
  ctx.closePath()
  ctx.fill()
  // Стена.
  ctx.fillStyle = colors.wall
  ctx.fillRect(left, top, wallW, wallH)
  // Окна: 4 × 6, по порядку дверец.
  const total = HOUSE_COLUMNS * HOUSE_ROWS
  const litCount = Math.min(total, Math.max(0, Math.floor(lit)))
  const padX = wallW * 0.1
  const padY = wallH * 0.07
  const gap = wallW * 0.06
  const cellW = (wallW - padX * 2 - gap * (HOUSE_COLUMNS - 1)) / HOUSE_COLUMNS
  const cellH = (wallH - padY * 2 - gap * (HOUSE_ROWS - 1)) / HOUSE_ROWS
  for (let index = 0; index < total; index += 1) {
    const x = left + padX + (index % HOUSE_COLUMNS) * (cellW + gap)
    const y = top + padY + Math.floor(index / HOUSE_COLUMNS) * (cellH + gap)
    ctx.fillStyle = index < litCount ? colors.window : colors.dark
    ctx.fillRect(x, y, cellW, cellH)
  }
  // Сугроб у подножия.
  if (typeof ctx.ellipse === 'function') {
    ctx.fillStyle = colors.snow
    ctx.beginPath()
    ctx.ellipse(area.centerX, area.bottom, wallW * 0.75, 26, 0, Math.PI, 0)
    ctx.fill()
  }
}

/** Рисует карточку на переданном canvas; вынесено для тестов без DOM. */
export const drawAdventCard = (canvas: HTMLCanvasElement, spec: AdventCardSpec, artwork?: HTMLImageElement): boolean => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const palette = getSeasonalThemePalette('christmas', false)
  const deep = palette?.sceneWordmark ?? '#35694f'
  const primary = palette?.primaryText ?? '#2f6b4f'
  const accent = palette?.accent ?? '#a5414e'
  const gold = palette?.sceneJewel ?? '#b98b38'
  const W = ADVENT_CARD_WIDTH
  const H = ADVENT_CARD_HEIGHT
  const pad = 88

  canvas.width = W
  canvas.height = H

  if (artwork) {
    ctx.drawImage(artwork, 0, 0, W, H)
    const shade = ctx.createLinearGradient(0, 0, 0, H)
    shade.addColorStop(0, 'rgba(3, 22, 35, 0.62)')
    shade.addColorStop(0.42, 'rgba(3, 22, 35, 0.18)')
    shade.addColorStop(0.56, 'rgba(3, 22, 35, 0)')
    shade.addColorStop(0.84, 'rgba(3, 22, 35, 0)')
    shade.addColorStop(1, 'rgba(3, 22, 35, 0.80)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, W, H)
  } else {
    const gradient = ctx.createLinearGradient(0, 0, W, H)
    gradient.addColorStop(0, '#173326')
    gradient.addColorStop(1, deep)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, W, H)
    drawSnow(ctx)

    // Лента сверху — акцент темы.
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, W, 18)
  }

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = artwork ? '#ffdf9e' : gold
  ctx.font = `600 ${artwork ? 29 : 34}px ${FONT}`
  let y = pad
  wrapLines(ctx, spec.eyebrow.toUpperCase(), W - pad * 2, 2).forEach((line) => {
    ctx.fillText(line, pad, y)
    y += 46
  })

  y += 16
  ctx.fillStyle = '#ffffff'
  ctx.font = artwork ? 'bold 85px Georgia, serif' : `700 76px ${FONT}`
  wrapLines(ctx, spec.title, W - pad * 2, 3).forEach((line) => {
    ctx.fillText(line, pad, y)
    y += 90
  })

  if (spec.hero) {
    y += 24
    ctx.font = `800 220px ${FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(spec.hero, pad, y)
    y += 240
  }

  if (spec.subtitle) {
    y += 12
    ctx.font = `400 40px ${FONT}`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)'
    wrapLines(ctx, spec.subtitle, W - pad * 2, 3).forEach((line) => {
      ctx.fillText(line, pad, y)
      y += 54
    })
  }

  // Плитки показателей: два столбца на светлой подложке.
  const stats = spec.stats.slice(0, 8)
  if (stats.length > 0) {
    y += 36
    const gap = 28
    const columns = 2
    const tileW = (W - pad * 2 - gap) / columns
    const tileH = 150
    stats.forEach((stat, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      const x = pad + col * (tileW + gap)
      const top = y + row * (tileH + gap)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, top, tileW, tileH, 28)
      else ctx.rect(x, top, tileW, tileH)
      ctx.fill()
      ctx.fillStyle = primary
      ctx.font = `800 58px ${FONT}`
      ctx.fillText(wrapLines(ctx, stat.value, tileW - 56, 1)[0] ?? '', x + 28, top + 24)
      ctx.fillStyle = '#4b4450'
      ctx.font = `500 28px ${FONT}`
      wrapLines(ctx, stat.label, tileW - 56, 2).forEach((line, lineIndex) => {
        ctx.fillText(line, x + 28, top + 92 + lineIndex * 32)
      })
    })
  }

  if (spec.house) {
    // Дом стоит над подписью внизу и занимает свободную середину карточки.
    const bottom = H - pad - 70
    const room = bottom - (y + 40)
    const width = Math.max(0, Math.min(W * 0.5, (room / 1.47)))
    if (width > 120) {
      drawHouse(ctx, { centerX: W / 2, bottom, width }, spec.house.lit, {
        wall: '#3b2f2a',
        roof: '#2a2220',
        snow: 'rgba(255, 255, 255, 0.92)',
        window: gold,
        dark: 'rgba(255, 255, 255, 0.12)',
      })
    }
  }

  if (spec.progress) {
    // Между текстом и подписью внизу (38px шрифт на `H - pad + 20`).
    drawProgressGrid(
      ctx,
      spec.progress,
      { left: pad, top: y + 40, width: W - pad * 2, bottom: H - pad - 48 },
      { done: gold, rest: 'rgba(255, 255, 255, 0.16)' },
    )
  }

  ctx.fillStyle = artwork ? '#fff4d9' : gold
  ctx.font = `700 38px ${FONT}`
  ctx.textBaseline = 'bottom'
  ctx.fillText(spec.footer ?? adventFooterUrl(), pad, H - pad + 20)
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

/**
 * PNG карточки или `null`, если canvas недоступен (native, SSR, старый браузер).
 * Синхронно (`toDataURL`, не `toBlob`): `navigator.share` требует свежего жеста
 * пользователя, а асинхронное кодирование между кликом и вызовом шеринга в
 * Safari его теряет (`NotAllowedError`).
 */
export function renderAdventCardPng(spec: AdventCardSpec, artwork?: HTMLImageElement): Blob | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  if (!drawAdventCard(canvas, spec, artwork)) return null
  try {
    return dataUrlToPngBlob(canvas.toDataURL('image/png'))
  } catch {
    return null
  }
}
