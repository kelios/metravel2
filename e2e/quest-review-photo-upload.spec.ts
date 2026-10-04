import fs from 'node:fs'
import path from 'node:path'

import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

/**
 * #2150: загрузка фото отзыва после финиша на мобильном вьюпорте.
 * - снимок 4032×3024 уходит уменьшенным до 1920 по длинной стороне;
 * - у каждого фото один статус, внизу «Загружено N из 3»;
 * - обрыв на втором фото → «Не загрузилось» и «Повторить», который догружает
 *   только его, без дублей первого и третьего.
 * `/api/upload` замокан (Fallback/mock policy карточки): реальную отправку
 * проверяет приёмка на проде.
 */

const WAIT_MS = 60_000
const ARTIFACT_DIR = path.join('.codex-temp', 'quest-2150')
const QUEST_ID = 'e2e-review-photo-upload'
const USER_ID = '7'
const REVIEW_ID = 2150

const fulfillJson = (route: Route, value: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })

const bundle = {
  id: 92150,
  quest_id: QUEST_ID,
  title: 'E2E фото к отзыву',
  cover_url: null,
  steps: [
    {
      id: 1,
      step_id: 'review-photo-step-1',
      title: 'Точка 1',
      location: 'Минск',
      story: 'Шаг для отзыва с фото.',
      task: 'Введите любое слово.',
      hint: 'Подойдёт любой непустой ответ.',
      answer_pattern: { type: 'any_text', value: { min_length: 1 } },
      lat: 53.9,
      lng: 27.5667,
      maps_url: 'https://www.openstreetmap.org/?mlat=53.9&mlon=27.5667',
      image_url: null,
      order: 1,
      is_intro: false,
      country_code: 'BY',
    },
  ],
  finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
  intro: null,
  storage_key: QUEST_ID,
  city: { id: 1, name: 'Минск', lat: 53.9, lng: 27.5667, country_code: 'BY' },
  rating_avg: null,
  rating_count: 0,
}

/** Ширина и высота JPEG из маркера SOF — без декодера в node. */
const jpegSize = (bytes: Buffer): { width: number; height: number } | null => {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    const length = bytes.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  return null
}

/** Файл из multipart-тела: имя и байты части `file`. */
const multipartFile = (body: Buffer): { name: string; bytes: Buffer } | null => {
  const text = body.toString('latin1')
  const header = text.match(/name="file"; filename="([^"]+)"[^\r]*\r\n(?:[^\r]+\r\n)*\r\n/)
  if (!header || header.index === undefined) return null
  const start = header.index + header[0].length
  const boundary = text.slice(0, text.indexOf('\r\n'))
  const end = text.indexOf(`\r\n${boundary}`, start)
  return { name: header[1], bytes: body.subarray(start, end) }
}

/** Большой JPEG, нарисованный в самом браузере: в node нет канваса. */
async function makeCameraJpeg(page: Page, seed: number): Promise<Buffer> {
  const base64 = await page.evaluate(async (s) => {
    const canvas = document.createElement('canvas')
    canvas.width = 4032
    canvas.height = 3024
    const ctx = canvas.getContext('2d')!
    let x = s * 9301 + 49297
    const rand = () => {
      x = (x * 9301 + 49297) % 233280
      return x / 233280
    }
    for (let i = 0; i < 4000; i += 1) {
      ctx.fillStyle = `hsl(${Math.floor(rand() * 360)},70%,${Math.floor(rand() * 60 + 20)}%)`
      ctx.fillRect(rand() * 4032, rand() * 3024, rand() * 300 + 10, rand() * 300 + 10)
    }
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95))
    const buffer = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let i = 0; i < buffer.length; i += 0x8000) {
      binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
    }
    return btoa(binary)
  }, seed)
  return Buffer.from(base64, 'base64')
}

async function mockQuestApis(page: Page) {
  await page.route('**/api/quest-reviews/**', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return fulfillJson(route, {
      id: REVIEW_ID,
      user: Number(USER_ID),
      quest: bundle.id,
      rating: 5,
      liked: '',
      disliked: '',
    })
  })
  await page.route(`**/quests/quest${bundle.id}/review/users/**`, (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  )
  await page.route(`**/quests/by-quest-id/${QUEST_ID}/**`, (route) => fulfillJson(route, bundle))
  await page.route('**/quest-progress/**', (route) => {
    if (route.request().method() === 'GET') {
      return fulfillJson(route, {
        id: 2150,
        quest: bundle.id,
        current_index: 0,
        unlocked_index: 0,
        answers: {},
        attempts: {},
        hints: {},
        show_map: true,
        completed: false,
      })
    }
    return fulfillJson(route, {
      id: 2150,
      quest: bundle.id,
      current_index: 1,
      unlocked_index: 1,
      answers: { 'review-photo-step-1': 'ответ' },
      attempts: {},
      hints: {},
      show_map: true,
      completed: true,
    })
  })
  await page.route('**/quests/quest*/reviews/**', (route) => fulfillJson(route, { results: [], next: null }))
}

test.describe('#2150 quest review photo upload', () => {
  test('compresses, shows one status per photo and retries only the failed one', async ({ page }) => {
    test.setTimeout(240_000)
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

    const uploads: Array<{ name: string; bytes: number; width: number; height: number; clientUploadId: string }> = []
    let uploadCalls = 0
    let failSecondOnce = true

    await preacceptCookies(page)
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'metravel_action_consents_v1',
          JSON.stringify({ quest_start: { version: '1', date: new Date().toISOString() } }),
        )
      } catch {
        // ignore
      }
    })
    await ensureAuthedStorageFallback(page, { userId: USER_ID, userName: 'E2E' })
    await mockFakeAuthApis(page)
    await mockQuestApis(page)

    await page.route(/\/api\/upload\/?(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      uploadCalls += 1
      const body = route.request().postDataBuffer() ?? Buffer.alloc(0)
      const file = multipartFile(body)
      const size = file ? jpegSize(file.bytes) : null
      const clientUploadId = body.toString('latin1').match(/name="client_upload_id"\r\n\r\n([^\r]+)/)?.[1] ?? ''
      // Второе фото в первый раз обрывается: так выглядит потерянная мобильная сеть.
      if (uploadCalls === 2 && failSecondOnce) {
        failSecondOnce = false
        return route.abort('connectionreset')
      }
      uploads.push({
        name: file?.name ?? '',
        bytes: file?.bytes.length ?? 0,
        width: size?.width ?? 0,
        height: size?.height ?? 0,
        clientUploadId,
      })
      await new Promise((resolve) => setTimeout(resolve, 400))
      return fulfillJson(route, { id: uploadCalls, url: `https://cdn.example/${uploadCalls}.webp` }, 201)
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await gotoWithRetry(page, `/quests/1/${QUEST_ID}`)

    const originals = [await makeCameraJpeg(page, 1), await makeCameraJpeg(page, 2), await makeCameraJpeg(page, 3)]

    const startButton = page.getByRole('button', { name: 'Начать квест' })
    await expect(startButton).toBeVisible({ timeout: WAIT_MS })
    await startButton.click()
    const answer = page.getByRole('textbox').first()
    await expect(answer).toBeVisible({ timeout: 30_000 })
    await answer.fill('ответ')
    await page.getByTestId('quest-step-check').click()

    const section = page.getByTestId('quest-review-section')
    await expect(section).toBeVisible({ timeout: WAIT_MS })
    const chooser = page.waitForEvent('filechooser')
    await section.getByTestId('quest-review-section-photos-add').click()
    await (await chooser).setFiles(
      originals.map((buffer, index) => ({ name: `IMG_000${index + 1}.jpg`, mimeType: 'image/jpeg', buffer })),
    )
    await expect(section.getByTestId('quest-review-section-photos-counter')).toHaveText('Выбрано 3 из 3', {
      timeout: WAIT_MS,
    })

    const fiveStar = section.getByRole('button', { name: 'Оценить на 5 из 5' }).last()
    await expect(fiveStar).toBeEnabled({ timeout: WAIT_MS })
    await fiveStar.click()
    await section.getByTestId('quest-review-section-submit').click()

    const summary = section.getByTestId('quest-review-section-photo-upload-summary')
    await expect(section.getByText('Спасибо за отзыв!')).toBeVisible({ timeout: WAIT_MS })
    await expect(summary).toHaveText('Загружено 2 из 3', { timeout: 120_000 })
    // Неактивного пикера «Выбрано 3 из 3» и второго «Загружаем фото…» больше нет.
    await expect(section.getByTestId('quest-review-section-photos-counter')).toHaveCount(0)
    await expect(section.getByText('Загружаем фото…')).toHaveCount(0)
    await expect(section.getByText('Не загрузилось')).toHaveCount(1)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'failed-390.png') })

    const retry = section.getByRole('button', { name: /Повторить загрузку фото/ })
    await expect(retry).toHaveCount(1)
    const retryBox = await retry.boundingBox()
    expect(retryBox?.height ?? 0).toBeGreaterThanOrEqual(44)
    await retry.click()

    await expect(summary).toHaveText('Загружено 3 из 3', { timeout: 120_000 })
    await expect(section.getByText('Не загрузилось')).toHaveCount(0)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'done-390.png') })

    fs.writeFileSync(path.join(ARTIFACT_DIR, 'uploads.json'), JSON.stringify({ uploadCalls, uploads }, null, 2))

    // 4 запроса: три фото + один повтор второго; первое и третье не продублированы.
    expect(uploadCalls).toBe(4)
    expect(uploads.map((upload) => upload.name)).toEqual(['IMG_0001.jpg', 'IMG_0003.jpg', 'IMG_0002.jpg'])
    expect(new Set(uploads.map((upload) => upload.clientUploadId)).size).toBe(3)
    uploads.forEach((upload) => {
      const original = originals[Number(upload.name.match(/(\d)\.jpg$/)?.[1]) - 1]
      expect(Math.max(upload.width, upload.height)).toBe(1920)
      expect(upload.bytes).toBeLessThan(original.length)
    })
  })
})
