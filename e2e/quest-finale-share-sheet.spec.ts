import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #1667: лист «Поделиться результатом» на финале квеста. Юнит-тест компонента
 * доказывает подписи и текст сообщения, но не доказывает ГЕОМЕТРИЮ: помещается
 * ли лист с превью-дипломом и полем «Имя героя» на экране телефона и не режется
 * ли подпись канала в колонке. Именно это здесь и проверяется на реальном DOM.
 *
 * Прохождение целиком на моках: настоящий прогон занял бы бейдж первопроходца
 * безвозвратно (#1434). Карточка-диплом тоже мок — иначе набор каналов зависел
 * бы от того, поднят ли серверный генератор.
 */

const QUEST_ID = 'e2e-finale-share-quest'
const QUEST_NUMERIC_ID = 91_667
const USER_ID = '7'
const CITY = { id: 1, name: 'Минск', lat: 53.9023, lng: 27.5619, country_code: 'BY' }
const CARD_IMAGE_URL = 'https://metravel.by/media/e2e-quest-result-card.png'
const CARD_PUBLIC_URL = 'https://metravel.by/quests/result/e2e-1667'

/** Худший случай подписей: длинный заголовок не должен ломать колонки каналов. */
const QUEST_TITLE = 'Минск: тайны Верхнего города'

// 1×1 PNG: превью-диплому нужен реальный байтовый ответ, иначе консоль
// засоряется ошибкой загрузки и проверка «консоль чистая» теряет смысл.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const buildStep = (order: number) => ({
  id: order,
  step_id: `finale-share-step-${order}`,
  title: `Точка ${order}`,
  location: CITY.name,
  story: 'Детерминированный шаг для проверки листа шаринга.',
  task: 'Введите любое слово.',
  hint: 'Подойдёт любой непустой ответ.',
  answer_pattern: { type: 'any_text', value: { min_length: 1 } },
  lat: CITY.lat,
  lng: CITY.lng,
  maps_url: 'https://www.openstreetmap.org/?mlat=53.9023&mlon=27.5619',
  image_url: null,
  order,
  is_intro: false,
  country_code: CITY.country_code,
})

const questBundle = {
  id: QUEST_NUMERIC_ID,
  quest_id: QUEST_ID,
  title: QUEST_TITLE,
  cover_url: null,
  steps: [buildStep(1), buildStep(2)],
  finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
  intro: null,
  storage_key: QUEST_ID,
  city: CITY,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
}

const serverProgress = {
  id: 1667,
  quest: QUEST_NUMERIC_ID,
  quest_id: QUEST_ID,
  current_index: 0,
  unlocked_index: 0,
  answers: {},
  attempts: {},
  hints: {},
  show_map: true,
  completed: false,
  updated_at: '2026-08-01T00:00:00Z',
}

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })

const mockApis = async (page: Page, options: { resultCard?: boolean } = {}) => {
  const resultCard = options.resultCard ?? true
  // Картинка-диплом: и прямой URL, и любой проксированный вариант (в query
  // прокси исходный адрес остаётся подстрокой).
  await page.route('**e2e-quest-result-card**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 }),
  )

  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname

    // Metro раздаёт ленивые чанки как `/api/<name>.bundle`, и они попадают под
    // ту же маску. Отдать им JSON — значит уронить загрузку модуля и получить
    // ошибку в консоли, которой на проде нет.
    if (pathname.endsWith('.bundle')) return route.continue()

    if (pathname.includes('/quests/result-cards/')) {
      // Генератор диплома недоступен: лист остаётся на публичной ссылке квеста,
      // и каналы «Картинка»/«Stories» не рисуются — сокращённый набор.
      if (!resultCard) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      return fulfillJson(route, {
        share_token: 'e2e-1667',
        image_url: CARD_IMAGE_URL,
        story_image_url: CARD_IMAGE_URL,
        public_url: CARD_PUBLIC_URL,
        expires_at: null,
      })
    }
    if (pathname.includes('/user/me/verifications/')) return fulfillJson(route, { ok: true })
    if (/\/user\/\d+\/profile\//.test(pathname)) {
      return fulfillJson(route, {
        id: Number(USER_ID),
        name: 'E2E',
        email: 'e2e@example.com',
        is_premium: false,
      })
    }
    if (pathname.includes(`/quests/by-quest-id/${QUEST_ID}/`)) return fulfillJson(route, questBundle)
    if (pathname.includes(`/quest-progress/quest/${QUEST_ID}/`)) return fulfillJson(route, serverProgress)
    if (/\/quest-progress\/\d+\/$/.test(pathname)) return fulfillJson(route, serverProgress)
    if (pathname.includes('/quest-progress/')) return fulfillJson(route, [])
    if (/\/quests\/?$/.test(pathname)) return fulfillJson(route, { results: [], next: null })
    if (pathname.includes('/reviews/')) return fulfillJson(route, [])
    return fulfillJson(route, {})
  })
}

/**
 * `navigator.share` объявляем сами: без него канал «Ещё» не рисуется, и лист
 * проверялся бы на четырёх колонках вместо худшего случая из пяти. `window.open`
 * перехватываем — иначе Telegram открылся бы новой вкладкой, а текст сообщения
 * остался бы недоказанным.
 */
const seedDevice = async (
  page: Page,
  locale: SupportedTestLocale = 'ru',
  options: { webShare?: boolean } = {},
) => {
  const webShare = options.webShare ?? true
  await page.addInitScript(({ user, locale: chosen, share }) => {
    try {
      const now = new Date().toISOString()
      window.localStorage.setItem('userId', user)
      // AsyncStorage на web пишет в localStorage без префикса, поэтому язык
      // задаётся тем же ключом, что и переключателем в шапке.
      window.localStorage.setItem(
        '@metravel/locale-preference:v1',
        JSON.stringify({ version: 1, mode: 'explicit', locale: chosen }),
      )
      window.localStorage.setItem('userName', 'E2E')
      window.localStorage.setItem('isSuperuser', 'false')
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: true, date: now }),
      )
      window.localStorage.setItem(
        'metravel_action_consents_v1',
        JSON.stringify({ quest_start: { version: '1', date: now } }),
      )
    } catch {
      // ignore
    }

    if (share) {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.resolve(),
      })
    }

    const opened: string[] = []
    Object.defineProperty(window, '__e2eOpenedUrls', { value: opened, configurable: false })
    window.open = ((url?: string | URL) => {
      opened.push(String(url ?? ''))
      return { closed: false, focus: () => {}, close: () => {} } as unknown as Window
    }) as typeof window.open
  }, { user: USER_ID, locale, share: webShare })
}

/** Прогон квеста до засчитанного финала. */
const finishQuest = async (page: Page) => {
  // По testID, а не по подписи: те же шаги проигрываются в пяти локалях.
  const startButton = page.getByTestId('quest-intro-start')
  await expect(startButton).toBeVisible({ timeout: 60_000 })
  await startButton.click()

  for (let step = 1; step <= questBundle.steps.length; step++) {
    const answer = page.getByRole('textbox').first()
    await expect(answer, `шаг ${step}: поле ответа`).toBeVisible({ timeout: 30_000 })
    await answer.fill(`ответ ${step}`)
    await page.getByTestId('quest-step-check').click()

    if (step < questBundle.steps.length) {
      await expect(
        page.getByRole('textbox').first(),
        `шаг ${step}: визард перешёл к следующей точке`,
      ).toHaveValue('', { timeout: 30_000 })
    }
  }

  // Визард открывает финал сам после последней точки. Пилюлю степпера здесь не
  // жмём: на 390pt она подписана «Ф», и клик по ней увёл бы падение в ложную
  // причину вместо «финал не открылся».
  await expect(
    page.getByText('Квест завершён.', { exact: true }).first(),
    'финал открыт',
  ).toBeVisible({ timeout: 30_000 })
}

type SupportedTestLocale = 'ru' | 'be' | 'uk' | 'pl' | 'en'

const CHANNEL_KEYS = ['copy', 'telegram', 'download', 'instagram', 'native'] as const

/**
 * Подписи каналов по локалям — из `i18n/locales/<loc>/static/quest_share_static.ts`.
 * Проверяем все пять: колонка узкая, и самая длинная подпись меняется от языка
 * к языку (UK «Посилання» длиннее BE «Спасылка», #1677).
 */
const CAPTIONS: Record<SupportedTestLocale, Record<(typeof CHANNEL_KEYS)[number], string>> = {
  ru: { copy: 'Ссылка', telegram: 'Telegram', download: 'Картинка', instagram: 'Stories', native: 'Ещё' },
  be: { copy: 'Спасылка', telegram: 'Telegram', download: 'Карцінка', instagram: 'Stories', native: 'Яшчэ' },
  uk: { copy: 'Посилання', telegram: 'Telegram', download: 'Картинка', instagram: 'Stories', native: 'Ще' },
  pl: { copy: 'Link', telegram: 'Telegram', download: 'Obrazek', instagram: 'Stories', native: 'Więcej' },
  en: { copy: 'Link', telegram: 'Telegram', download: 'Image', instagram: 'Stories', native: 'More' },
}

const CHANNELS = CHANNEL_KEYS.map((key) => ({ key, caption: CAPTIONS.ru[key] }))

/**
 * Лист выезжает снизу CSS-анимацией react-native-web, и в её середине колонка
 * каналов честно лежит ниже нижней кромки экрана. Меряем только УСТОЯВШУЮСЯ
 * геометрию: ждём, пока положение каналов перестанет меняться между кадрами,
 * иначе проверка «лист помещается» ловила бы момент выезда, а не результат.
 */
const waitForSheetSettled = async (page: Page) => {
  const readTop = () =>
    page.evaluate(() => {
      const node = document.querySelector('[data-testid="quest-share-channel-copy"]')
      return node ? Math.round(node.getBoundingClientRect().top) : null
    })

  let previous: number | null = null
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = await readTop()
    if (current !== null && current === previous) return
    previous = current
    await page.waitForTimeout(150)
  }
  throw new Error('лист шаринга не остановился: анимация выезда не завершилась за 9 с')
}

const openShareSheet = async (page: Page, options: { preview?: boolean } = {}) => {
  await page.getByTestId('quest-finale-share').click()
  if (options.preview ?? true) {
    // Превью-диплом приходит из мок-карточки: пока он не отрисован, набор
    // каналов ещё неполный и мерить геометрию рано.
    await expect(page.getByTestId('quest-result-card-preview')).toBeVisible({ timeout: 30_000 })
  } else {
    await expect(page.getByTestId('quest-share-channel-copy')).toBeVisible({ timeout: 30_000 })
  }
  await waitForSheetSettled(page)
}

/** Ширина всего кластера каналов — от левой кромки первой колонки до правой кромки последней. */
const channelClusterSpan = async (page: Page, lastKey: string) => {
  const first = await page.getByTestId('quest-share-channel-copy').boundingBox()
  const last = await page.getByTestId(`quest-share-channel-${lastKey}`).boundingBox()
  expect(first, 'бокс первой колонки').not.toBeNull()
  expect(last, 'бокс последней колонки').not.toBeNull()
  return { left: first!.x, right: last!.x + last!.width, span: last!.x + last!.width - first!.x }
}

/**
 * Подпись «видима» только если она не срезана многоточием: у RN Web
 * `numberOfLines={1}` даёт ellipsis, и обрезанный текст остался бы в DOM
 * целиком, пройдя обычную проверку на текст.
 */
const captionOverflow = (page: Page, caption: string) =>
  page.evaluate((text) => {
    const node = Array.from(document.querySelectorAll('div,span')).find(
      (el) => el.children.length === 0 && el.textContent?.trim() === text,
    )
    if (!node) return null
    return { scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }
  }, caption)

test.describe('Лист шаринга результата квеста (#1667)', () => {
  test('mobile web 390×844: каналы подписаны, лист не выходит за нижнюю кромку', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await preacceptCookies(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await mockApis(page)
    await seedDevice(page)

    await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
    await finishQuest(page)
    await openShareSheet(page)

    // Каждый канал подписан видимым текстом, а не только accessibilityLabel.
    for (const channel of CHANNELS) {
      const button = page.getByTestId(`quest-share-channel-${channel.key}`)
      await expect(button, `канал ${channel.key} в листе`).toBeVisible()
      await expect(button.getByText(channel.caption, { exact: true })).toBeVisible()

      const overflow = await captionOverflow(page, channel.caption)
      expect(overflow, `подпись «${channel.caption}» найдена в DOM`).not.toBeNull()
      expect(
        overflow!.scrollWidth,
        `подпись «${channel.caption}» не срезана в колонке`,
      ).toBeLessThanOrEqual(overflow!.clientWidth + 1)
    }

    // Превью и поле «Имя героя» на месте — и всё-таки не выталкивают каналы
    // за нижнюю кромку экрана.
    await expect(page.getByTestId('quest-result-hero-name')).toBeVisible()

    const lastChannel = await page.getByTestId('quest-share-channel-native').boundingBox()
    expect(lastChannel, 'бокс последнего канала').not.toBeNull()
    expect(
      lastChannel!.y + lastChannel!.height,
      'нижняя кромка каналов внутри экрана 844',
    ).toBeLessThanOrEqual(844)

    const preview = await page.getByTestId('quest-result-card-preview').boundingBox()
    expect(preview, 'бокс превью-диплома').not.toBeNull()
    expect(preview!.y, 'верх превью не уехал за верхнюю кромку').toBeGreaterThanOrEqual(0)

    // Тач-таргет колонки канала — не меньше 44dp по обеим осям.
    const copyBox = await page.getByTestId('quest-share-channel-copy').boundingBox()
    expect(copyBox!.width, 'ширина тач-таргета канала').toBeGreaterThanOrEqual(44)
    expect(copyBox!.height, 'высота тач-таргета канала').toBeGreaterThanOrEqual(44)

    // Снимок листа — доказательство приёмки Done gate, каталог артефактов игнорируется git.
    await page.screenshot({ path: 'test-results/quest-1667-share-sheet-390.png' })

    expect(consoleErrors, 'консоль без ошибок').toEqual([])
  })

  test('Telegram уходит с результатом и доменом, без «попробуй и ты»', async ({ page }) => {
    await preacceptCookies(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await mockApis(page)
    await seedDevice(page)

    await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
    await finishQuest(page)
    await openShareSheet(page)

    await page.getByTestId('quest-share-channel-telegram').click()

    const opened = await page.evaluate(() => (window as any).__e2eOpenedUrls ?? [])
    expect(opened.length, 'Telegram открыт ровно один раз').toBe(1)

    const url = new URL(String(opened[0]))
    expect(url.hostname).toBe('t.me')
    const caption = url.searchParams.get('text') ?? ''
    expect(caption).toContain(QUEST_TITLE)
    expect(caption).toContain('2 из 2')
    expect(caption).toContain('metravel.by')
    expect(caption).not.toContain('попробуй и ты')
    // Ссылка ведёт на публичную страницу результата, а не на сам квест.
    expect(String(url.searchParams.get('url'))).toContain('/quests/result/')
  })

  /**
   * #1677: колонка канала раньше получала ровно 1/5 ряда, и подпись, которая в
   * русском помещалась, в украинском срезалась эллипсисом. Обе ширины телефона
   * меряем в ОДНОМ прогоне на локаль: разница между ними — только вьюпорт, а
   * прохождение квеста стоит десятки секунд.
   */
  for (const locale of ['ru', 'be', 'uk', 'pl', 'en'] as const) {
    test(`${locale}: ни одна подпись канала не срезана на 360 и 390pt`, async ({ page }) => {
      await preacceptCookies(page)
      await page.setViewportSize({ width: 390, height: 844 })
      await mockApis(page)
      await seedDevice(page, locale)

      await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
      await finishQuest(page)
      await openShareSheet(page)

      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 })
        await waitForSheetSettled(page)

        for (const key of CHANNEL_KEYS) {
          const caption = CAPTIONS[locale][key]
          await expect(
            page.getByTestId(`quest-share-channel-${key}`).getByText(caption, { exact: true }),
            `подпись «${caption}» отрисована на ${width}pt`,
          ).toBeVisible()

          const overflow = await captionOverflow(page, caption)
          expect(overflow, `подпись «${caption}» найдена в DOM`).not.toBeNull()
          expect(
            overflow!.scrollWidth,
            `подпись «${caption}» не срезана на ${width}pt`,
          ).toBeLessThanOrEqual(overflow!.clientWidth + 1)

          // Тач-таргет не приносится в жертву ширине подписи.
          const box = await page.getByTestId(`quest-share-channel-${key}`).boundingBox()
          expect(box!.width, `тач-таргет ${key} на ${width}pt`).toBeGreaterThanOrEqual(44)
          expect(box!.height, `тач-таргет ${key} на ${width}pt`).toBeGreaterThanOrEqual(44)
        }

        // Кластер каналов целиком внутри экрана и остаётся центрированным:
        // отступы слева и справа равны с точностью до пикселя округления.
        const cluster = await channelClusterSpan(page, 'native')
        expect(cluster.right, `правая кромка кластера на ${width}pt`).toBeLessThanOrEqual(width)
        expect(
          Math.abs(cluster.left - (width - cluster.right)),
          `кластер центрирован на ${width}pt`,
        ).toBeLessThanOrEqual(2)

        if (locale === 'uk' && width === 390) {
          await page.screenshot({ path: 'test-results/quest-1677-share-sheet-uk-390.png' })
        }
      }
    })
  }

  /**
   * Лист растянут на всю ширину вьюпорта, поэтому раскладка ряда обязана
   * оставаться кластером, а не распоркой: `space-between` размазал бы пять
   * каналов по 1232pt десктопа (#1677, findings ревью).
   */
  test('desktop 1280: ряд каналов остаётся компактным кластером по центру', async ({ page }) => {
    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockApis(page)
    await seedDevice(page)

    await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
    await finishQuest(page)
    await openShareSheet(page)

    for (const channel of CHANNELS) {
      await expect(
        page.getByTestId(`quest-share-channel-${channel.key}`).getByText(channel.caption, { exact: true }),
        `подпись канала ${channel.key} на десктопе`,
      ).toBeVisible()
    }

    const cluster = await channelClusterSpan(page, 'native')
    expect(cluster.span, 'ширина кластера пяти каналов на десктопе').toBeLessThanOrEqual(520)
    expect(
      Math.abs(cluster.left - (1280 - cluster.right)),
      'кластер центрирован на десктопе',
    ).toBeLessThanOrEqual(2)

    await page.screenshot({ path: 'test-results/quest-1667-share-sheet-1280.png' })
  })

  /**
   * Сокращённый набор: генератор диплома недоступен и Web Share нет — остаются
   * только «Ссылка» и «Telegram». Две колонки обязаны стоять рядом, а не
   * разъехаться по кромкам экрана.
   */
  test('без карточки и Web Share две колонки стоят рядом, а не по кромкам', async ({ page }) => {
    await preacceptCookies(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await mockApis(page, { resultCard: false })
    await seedDevice(page, 'ru', { webShare: false })

    await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
    await finishQuest(page)
    await openShareSheet(page, { preview: false })

    await expect(page.getByTestId('quest-share-channel-download')).toHaveCount(0)
    await expect(page.getByTestId('quest-share-channel-instagram')).toHaveCount(0)
    await expect(page.getByTestId('quest-share-channel-native')).toHaveCount(0)

    const cluster = await channelClusterSpan(page, 'telegram')
    expect(cluster.span, 'ширина кластера из двух каналов').toBeLessThanOrEqual(200)
    expect(
      Math.abs(cluster.left - (390 - cluster.right)),
      'кластер из двух каналов центрирован',
    ).toBeLessThanOrEqual(2)
  })
})
