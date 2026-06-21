// Общие тоновые помощники гравюрного арт-направления (состаренная бумага +
// тёплая линия). Используются BadgeEmblem и иконками блока геймификации,
// чтобы диск/линия выглядели одинаково в light/dark.

// Тёплая тёмная сепия — целевой тон диска в dark-режиме (тёмный пергамент).
export const DARK_PAPER_BASE = '#2A2117'
// Тёплый светлый тон линии под тёмную тему (состаренные чернила на пергаменте).
export const DARK_LINE_BASE = '#F0E2C8'

/** Тон диска: под тёмную тему уводим в тёплую сепию, не в нейтральный чёрный. */
export function paperFor(paper: string, isDark: boolean): string {
  return isDark ? mix(paper, DARK_PAPER_BASE, 0.78) : paper
}

/** Тон линии: под тёмную тему осветляем в тёплый пергаментный. */
export function lineFor(line: string, isDark: boolean): string {
  return isDark ? mix(line, DARK_LINE_BASE, 0.72) : line
}

/** Простое смешивание hex-цветов (RN-svg принимает строки — считаем сами). */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const r = Math.round(ca.r + (cb.r - ca.r) * t)
  const g = Math.round(ca.g + (cb.g - ca.g) * t)
  const bl = Math.round(ca.b + (cb.b - ca.b) * t)
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
}
