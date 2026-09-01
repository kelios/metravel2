import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import {
  FALLBACK_TRAVEL_SLUG,
  mockFallbackTravelDetails,
  preacceptCookies,
  gotoWithRetry,
} from './helpers/navigation'
import {
  QUEST_TILE_MEDIA_SIZE,
  QUEST_TILE_MEDIA_SIZE_COMPACT,
  QUEST_TILE_SLOT_RATIO,
} from '../components/quests/questCoverTileGeometry'

/**
 * #1542: квадратный вариант обложки в плитке.
 *
 * Сторона плитки — не литерал этого файла, а `questCoverTileGeometry`: с #1673
 * телефон (<480pt) берёт компактную сторону, остальные ширины — базовую.
 * Квадратность и `contain` инвариантны для обеих.
 *
 * Production square-поля nullable и пока null (#1587). After-состояние
 * доказывается перехватом манифеста: браузер грузит квадратный растр, доля
 * поля ≤ 0.10. Fallback без square остаётся на ландшафтном URL.
 */

const WAIT_MS = 60_000
const TARGET_BAND = 0.1
// #1673: компактная плитка включается ровно там же, где `isNarrowColumn`
// в `QuestForCityCard` — на телефоне, то есть ниже планшетной границы.
const COMPACT_MAX_WIDTH = 480
const tileSideForWidth = (width: number) =>
  width < COMPACT_MAX_WIDTH ? QUEST_TILE_MEDIA_SIZE_COMPACT : QUEST_TILE_MEDIA_SIZE
const ARTIFACT_DIR = path.join('.codex-temp', 'quest-1542')
const SQUARE_160 = '/quest-cover/e2e/square-160.webp'
const SQUARE_320 = '/quest-cover/e2e/square-320.webp'
const LANDSCAPE = '/quest-cover/e2e/landscape-16x9.webp'
const QUEST_ID = 'e2e-square-cover'
const NEAR_QUEST_ID = 'e2e-square-cover-near'

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const [r, g, b] = rgb
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const SQUARE_160_PNG = solidPng(160, 160, [36, 99, 58])
const SQUARE_320_PNG = solidPng(320, 320, [36, 99, 58])
const LANDSCAPE_PNG = solidPng(320, 180, [120, 72, 40])

const fulfillJson = (route: Route, value: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })

const squareCover = {
  aspect_ratio: 1,
  width: 320,
  height: 320,
  src: SQUARE_320,
  src_square: SQUARE_320,
  srcset_square: `${SQUARE_160} 160w, ${SQUARE_320} 320w`,
  sizes_hint_square: '132px',
  variants: { square_160: SQUARE_160, square_320: SQUARE_320 },
}

const landscapeCover = {
  aspect_ratio: 16 / 9,
  width: 320,
  height: 180,
  src: LANDSCAPE,
  src_square: null,
  srcset_square: null,
  sizes_hint_square: null,
  variants: { square_160: null, square_320: null },
}

const catalogEntry = (over: {
  quest_id: string
  title: string
  cover: typeof squareCover | typeof landscapeCover
  lat?: number
  lng?: number
  is_completed_by_me?: boolean
}) => ({
  id: over.quest_id === QUEST_ID ? 91542 : 91543,
  quest_id: over.quest_id,
  title: over.title,
  points: 7,
  city_id: '1',
  city_name: 'Гомель',
  country_id: '1',
  country_name: 'Беларусь',
  country_code: 'BY',
  lat: over.lat ?? 52.4238936,
  lng: over.lng ?? 31.0131698,
  duration_min: 90,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: over.cover.src,
  media: { cover: over.cover },
  rating_avg: null,
  rating_count: 0,
  completions_count: 0,
  is_completed_by_me: over.is_completed_by_me ?? false,
  first_completer: null,
})

const buildStep = (order: number) => ({
  id: order,
  step_id: `square-cover-step-${order}`,
  title: `Точка ${order}`,
  location: 'Гомель',
  story: 'Шаг для замера плитки на финале.',
  task: 'Введите любое слово.',
  hint: 'Подойдёт любой непустой ответ.',
  answer_pattern: { type: 'any_text', value: { min_length: 1 } },
  lat: 52.4238936,
  lng: 31.0131698,
  maps_url: 'https://www.openstreetmap.org/?mlat=52.4238936&mlon=31.0131698',
  image_url: null,
  order,
  is_intro: false,
  country_code: 'PL',
})

const questBundle = {
  id: 91542,
  quest_id: QUEST_ID,
  title: 'E2E квадратная обложка',
  cover_url: SQUARE_320,
  steps: [buildStep(1)],
  finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
  intro: null,
  storage_key: QUEST_ID,
  city: { id: 1, name: 'Гомель', lat: 52.4238936, lng: 31.0131698, country_code: 'BY' },
  rating_avg: null,
  rating_count: 0,
}

type BarMeasurement = {
  surface: string
  viewport: string
  expectedSide: number
  questId: string
  slotWidth: number
  slotHeight: number
  naturalWidth: number
  naturalHeight: number
  currentSrc: string
  objectFit: string
  imgCount: number
  bandShare: number
}

async function measureTile(page: Page, questId: string): Promise<BarMeasurement> {
  const viewport = page.locator(`[data-testid="quest-card-media-viewport-${questId}"]`).first()
  await expect(viewport).toBeVisible({ timeout: WAIT_MS })
  await viewport.scrollIntoViewIfNeeded()

  const img = viewport.locator('img').first()
  await expect(img).toBeVisible({ timeout: WAIT_MS })
  await expect.poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), {
    timeout: WAIT_MS,
  }).toBeGreaterThan(0)

  return img.evaluate(
    (el: HTMLImageElement, args: { questId: string }) => {
      const slot = el.closest('[data-testid^="quest-card-media-viewport-"]') as HTMLElement | null
      const slotWidth = slot?.clientWidth ?? 0
      const slotHeight = slot?.clientHeight ?? 0
      const naturalAspect = el.naturalHeight ? el.naturalWidth / el.naturalHeight : 0
      const renderedHeight = Math.min(slotHeight, naturalAspect ? slotWidth / naturalAspect : 0)
      const bandShare = slotHeight ? (slotHeight - renderedHeight) / 2 / slotHeight : 1
      return {
        surface: '',
        viewport: '',
        expectedSide: 0,
        questId: args.questId,
        slotWidth,
        slotHeight,
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
        currentSrc: el.currentSrc,
        objectFit: getComputedStyle(el).objectFit,
        imgCount: slot ? slot.querySelectorAll('img').length : 0,
        bandShare,
      }
    },
    { questId },
  )
}

async function writeArtifact(name: string, value: unknown) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  fs.writeFileSync(path.join(ARTIFACT_DIR, name), JSON.stringify(value, null, 2))
}

async function stubSquareImages(page: Page) {
  await page.route('**/quest-cover/e2e/**', async (route) => {
    const url = route.request().url()
    const body = url.includes('landscape')
      ? LANDSCAPE_PNG
      : url.includes('160')
        ? SQUARE_160_PNG
        : SQUARE_320_PNG
    await route.fulfill({ status: 200, contentType: 'image/png', body })
  })
}

test.describe('#1542 square quest cover tile', () => {
  test('square manifest keeps letterbox ≤ 0.10 on home, travel details and finale', async ({
    page,
  }, testInfo) => {
    const httpErrors: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`)
    })

    const squareQuest = catalogEntry({
      quest_id: QUEST_ID,
      title: 'E2E квадратная обложка',
      cover: squareCover,
      lat: 52.4238936,
      lng: 31.0131698,
    })
    const nearQuest = catalogEntry({
      quest_id: NEAR_QUEST_ID,
      title: 'Соседний квест рядом',
      cover: squareCover,
      lat: 52.4338936,
      lng: 31.0131698,
    })
    const catalog = [squareQuest, nearQuest]

    await preacceptCookies(page)
    await stubSquareImages(page)
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      const pathname = url.pathname.replace(/\/+$/, '')

      if (pathname.includes('/quest-cover/e2e/')) return route.fallback()
      if (pathname.includes('/user/me/verifications')) return fulfillJson(route, { ok: true })
      if (/\/user\/\d+\/profile/.test(pathname)) {
        return fulfillJson(route, { id: 7, name: 'E2E', email: 'e2e@example.com', is_premium: false })
      }
      if (pathname.includes(`/quests/by-quest-id/${QUEST_ID}`)) return fulfillJson(route, questBundle)
      if (pathname.includes(`/quest-progress/quest/${QUEST_ID}`)) {
        return fulfillJson(route, {
          id: 1542,
          quest: questBundle.id,
          current_index: 0,
          unlocked_index: 0,
          answers: {},
          attempts: {},
          hints: {},
          show_map: true,
          completed: false,
        })
      }
      if (pathname.includes('/quest-progress')) return fulfillJson(route, [])
      if (pathname.includes('/quests/near-location')) {
        return fulfillJson(route, {
          count: 1,
          results: [{ quest: squareQuest, score: 1, distance_km: 0.4 }],
        })
      }
      if (pathname.endsWith('/quests') || pathname.endsWith('/api/quests')) {
        return fulfillJson(route, { results: catalog, next: null })
      }
      if (pathname.includes('/reviews')) return fulfillJson(route, { results: [], next: null })
      if (pathname.includes('/quest-reviews')) return fulfillJson(route, {}, 401)
      return route.fallback()
    })
    await mockFallbackTravelDetails(page)

    const measurements: BarMeasurement[] = []
    const viewports = [
      { name: '1280', width: 1280, height: 900 },
      { name: '390', width: 390, height: 844 },
    ] as const

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      await gotoWithRetry(page, '/')
      const homeTile = page.locator(`[data-testid="quest-card-media-viewport-${QUEST_ID}"]`).first()
      await homeTile.scrollIntoViewIfNeeded()
      const home = await measureTile(page, QUEST_ID)
      home.surface = 'home'
      home.viewport = viewport.name
      home.expectedSide = tileSideForWidth(viewport.width)
      measurements.push(home)
      await homeTile.screenshot({
        path: path.join(ARTIFACT_DIR, `home-${viewport.name}.png`),
      })

      await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`)
      const travelSection = page.getByTestId('quest-for-city-section').first()
      await expect(travelSection).toBeVisible({ timeout: WAIT_MS })
      await travelSection.scrollIntoViewIfNeeded()
      const travel = await measureTile(page, QUEST_ID)
      travel.surface = 'travel-details'
      travel.viewport = viewport.name
      travel.expectedSide = tileSideForWidth(viewport.width)
      measurements.push(travel)
      await page
        .locator(`[data-testid="quest-card-media-viewport-${QUEST_ID}"]`)
        .first()
        .screenshot({ path: path.join(ARTIFACT_DIR, `travel-${viewport.name}.png`) })

      await gotoWithRetry(page, `/quests/1/${QUEST_ID}`)
      const finaleSection = page.getByRole('region', { name: 'Следующий квест рядом' })
      const startButton = page.getByRole('button', { name: 'Начать квест' })
      await expect(finaleSection.or(startButton).first()).toBeVisible({ timeout: WAIT_MS })
      if (await startButton.isVisible()) {
        await startButton.click()
        const answer = page.getByRole('textbox').first()
        await expect(answer).toBeVisible({ timeout: 30_000 })
        await answer.fill('ответ 1')
        await page.getByTestId('quest-step-check').click()
        await expect(page.getByText('Квест завершён.', { exact: true }).first()).toBeVisible({
          timeout: 30_000,
        })
      }
      await expect(finaleSection).toBeVisible({ timeout: WAIT_MS })
      const finale = await measureTile(page, NEAR_QUEST_ID)
      finale.surface = 'quest-finale'
      finale.viewport = viewport.name
      finale.expectedSide = tileSideForWidth(viewport.width)
      measurements.push(finale)
      await page
        .locator(`[data-testid="quest-card-media-viewport-${NEAR_QUEST_ID}"]`)
        .first()
        .screenshot({ path: path.join(ARTIFACT_DIR, `finale-${viewport.name}.png`) })
    }

    await writeArtifact(`bars-${testInfo.project.name}.json`, {
      measurements,
      httpErrors: httpErrors.filter((entry) => !entry.includes('quest-cover/e2e')),
    })

    for (const row of measurements) {
      expect(row.slotWidth, `${row.surface} ${row.viewport} slot width`).toBe(row.expectedSide)
      expect(row.slotHeight, `${row.surface} ${row.viewport} slot height`).toBe(
        row.expectedSide / QUEST_TILE_SLOT_RATIO,
      )
      expect(row.objectFit).toBe('contain')
      expect(row.naturalWidth).toBe(row.naturalHeight)
      expect(row.imgCount).toBeLessThanOrEqual(1)
      expect(row.currentSrc).toMatch(/square-160|square-320/)
      expect(row.bandShare, `${row.surface} ${row.viewport} band ${row.bandShare}`).toBeLessThanOrEqual(
        TARGET_BAND,
      )
    }

    expect(
      httpErrors.filter((entry) => /quest-cover|\/api\/quests/.test(entry) && /^(4|5)\d\d /.test(entry)),
    ).toEqual([])
  })

  test('null square fields keep the landscape cover URL', async ({ page }) => {
    await preacceptCookies(page)
    await stubSquareImages(page)
    const landscapeQuest = catalogEntry({
      quest_id: QUEST_ID,
      title: 'E2E ландшафтная обложка',
      cover: landscapeCover,
    })

    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname.replace(/\/+$/, '')
      if (pathname.includes('/quest-cover/e2e/')) return route.fallback()
      if (pathname.endsWith('/quests') || pathname.endsWith('/api/quests')) {
        return fulfillJson(route, { results: [landscapeQuest], next: null })
      }
      return route.fallback()
    })

    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoWithRetry(page, '/')
    const measured = await measureTile(page, QUEST_ID)
    expect(measured.currentSrc).toContain('landscape-16x9')
    expect(measured.currentSrc).not.toMatch(/square-160|square-320/)
    expect(measured.bandShare).toBeGreaterThan(TARGET_BAND)
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    await page
      .locator(`[data-testid="quest-card-media-viewport-${QUEST_ID}"]`)
      .first()
      .screenshot({ path: path.join(ARTIFACT_DIR, 'fallback-landscape-1280.png') })
    await writeArtifact('fallback-landscape.json', measured)
  })
})
