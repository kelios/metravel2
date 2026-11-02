import fs from 'node:fs'
import path from 'node:path'

import { mobileProfile } from '@/e2e/helpers/mobileProfile'

// Как в остальных jest-тестах e2e-хелперов: настоящий `@playwright/test` в jest не грузим.
jest.mock('@playwright/test', () => ({ devices: { 'Pixel 7': { userAgent: 'unit-pixel-7' } } }))

// #2928: мобильный профиль e2e собирается только через `mobileProfile` —
// профиль с одним `viewport` наследует десктопный `screen` 1920×1080.
const E2E_ROOT = path.resolve(__dirname, '../../e2e')
const HELPER = 'helpers/mobileProfile.ts'
// Здесь `isMobile` — флаг ветки сценария внутри одного контекста
// (`setViewportSize`), а не эмуляция устройства.
const BRANCH_FLAG_FILES = new Set(['helpers/travelHeroFavorite.ts', 'helpers/travelStickyActionsViewport.ts'])
// Модуль грузит и обычный node (e2e/prod-probe), TS-хелпер ему недоступен:
// профиль собран на месте, но `screen` обязан быть задан явно.
const PLAIN_NODE_FILES = new Set(['helpers/editorFixtureBrowser.js'])

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listSources(full)
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [full] : []
  })

describe('e2e mobile profile guard', () => {
  it('builds every mobile emulation profile through mobileProfile()', () => {
    const offenders = listSources(E2E_ROOT)
      .map((file) => path.relative(E2E_ROOT, file).split(path.sep).join('/'))
      .filter((rel) => rel !== HELPER && !BRANCH_FLAG_FILES.has(rel) && !PLAIN_NODE_FILES.has(rel))
      // Любое значение, кроме `false`: `true`, `PIXEL_7.isMobile`,
      // `devices['Pixel 7'].isMobile`, `width === 390`.
      .filter((rel) => /\bisMobile\s*:\s*(?!false\b|boolean\b)[^\s,}]/.test(
        fs.readFileSync(path.join(E2E_ROOT, rel), 'utf8'),
      ))
    expect(offenders).toEqual([])
  })

  it('keeps an explicit phone screen in plain-node profiles', () => {
    for (const rel of PLAIN_NODE_FILES) {
      expect(fs.readFileSync(path.join(E2E_ROOT, rel), 'utf8')).toMatch(/\bscreen:\s*viewport\b/)
    }
  })

  it('gives the phone a phone-sized screen, not the inherited desktop one', () => {
    expect(mobileProfile()).toMatchObject({
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
    const custom = mobileProfile({ viewport: { width: 320, height: 640 } })
    expect(custom.screen).toEqual({ width: 320, height: 640 })
  })
})
