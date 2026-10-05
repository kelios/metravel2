import {
  ICON_FONT_ATTR,
  ICON_FONT_DATASET,
  ICON_FONT_FAMILY,
  ICON_FONT_LCP_IMAGE_SELECTOR,
  ICON_FONT_READY_CLASS,
  ICON_FONT_STYLE_ID,
  buildFontDisplayPolicyScript,
  buildIconFontLoaderScript,
  getIconFontGuardCss,
} from '@/utils/iconFontShell'

/**
 * #2170: шрифт иконок подключает оболочка документа. Контракт — порядок: шрифт
 * не должен отнимать канал у LCP-картинки первого экрана (замер прода: ранний
 * запрос сдвигал LCP на ~190 мс), но и не должен ждать гидратации (на медленной
 * сети это десятки секунд пустых кнопок).
 */

const FONT_URL = '/assets/fonts/Feather.abc123.ttf'

type FontLoadCall = { query: string; resolve: () => void; reject: () => void }

/** `document.fonts.load` с управляемым исходом: каждый вызов — отдельная запись. */
const installFontLoadingApi = () => {
  const calls: FontLoadCall[] = []
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      load: (query: string) =>
        new Promise<unknown[]>((resolve, reject) => {
          calls.push({ query, resolve: () => resolve([{}]), reject: () => reject(new Error('network')) })
        }),
    },
  })
  return calls
}

const uninstallFontLoadingApi = () => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: undefined })
}

const fontFaceRules = () =>
  Array.from(document.head.querySelectorAll(`style#${ICON_FONT_STYLE_ID}`)).map((node) => node.textContent)

const EXPECTED_RULE = `@font-face{font-family:${'feather'};src:url("${'/assets/fonts/Feather.abc123.ttf'}");font-display:block}`

const runLoader = () => {
  // Исполняем тот же текст, что уйдёт в <script>.
  new Function(buildIconFontLoaderScript(FONT_URL))()
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const isReady = () => document.documentElement.classList.contains(ICON_FONT_READY_CLASS)

describe('iconFontShell', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    uninstallFontLoadingApi()
  })

  describe('критический CSS', () => {
    it('прячет иконку и снимает глиф запасного шрифта из раскладки, пока гарнитура не готова', () => {
      const css = getIconFontGuardCss()
      expect(css).toBe(
        `html:not(.${ICON_FONT_READY_CLASS}) [${ICON_FONT_ATTR}]{visibility:hidden;font-size:0!important}`,
      )
    })

    it('метка узла приходит через dataSet RN-Web и разворачивается в тот же атрибут', () => {
      expect(ICON_FONT_DATASET).toEqual({ iconFont: ICON_FONT_FAMILY })
      // RN-Web: iconFont -> data-icon-font.
      expect(ICON_FONT_ATTR).toBe('data-icon-font')
    })
  })

  describe('скрипт регистрации шрифта', () => {
    it('без LCP-картинки на первом экране стартует сразу и открывает иконки по готовности шрифта', async () => {
      const calls = installFontLoadingApi()
      runLoader()

      // Гарнитуру объявляет обычное правило @font-face — проверенный путь отрисовки.
      expect(fontFaceRules()).toEqual([EXPECTED_RULE])
      expect(calls.map((call) => call.query)).toEqual([`1em ${ICON_FONT_FAMILY}`])
      // Гарнитура ещё в пути — иконки скрыты, «квадратов» запасного шрифта нет.
      expect(isReady()).toBe(false)

      calls[0].resolve()
      await flush()
      expect(isReady()).toBe(true)
    })

    it.each([
      ['SSG-шелл главной и статьи', '<img data-ssg-lcp="true" src="/hero.webp">'],
      ['hero серверной разметки', '<img data-lcp src="/hero.webp">'],
      ['плитка карты', '<img data-ssg-map-tile="true" src="/tile.png">'],
    ])('уступает канал LCP-картинке: %s', async (_name, markup) => {
      const calls = installFontLoadingApi()
      document.body.innerHTML = markup
      const img = document.querySelector('img') as HTMLImageElement
      Object.defineProperty(img, 'complete', { configurable: true, value: false })

      runLoader()
      // Картинка ещё грузится — ни правила, ни запроса шрифта нет.
      expect(fontFaceRules()).toEqual([])
      expect(calls).toHaveLength(0)

      img.dispatchEvent(new Event('load'))
      expect(fontFaceRules()).toEqual([EXPECTED_RULE])
      expect(calls).toHaveLength(1)
    })

    it('селектор LCP-картинок покрывает все три разметки первого экрана', () => {
      expect(ICON_FONT_LCP_IMAGE_SELECTOR.split(',')).toEqual([
        'img[data-ssg-lcp]',
        'img[data-lcp]',
        'img[data-ssg-map-tile]',
      ])
    })

    it('не ждёт картинку, которая уже загружена', () => {
      const calls = installFontLoadingApi()
      document.body.innerHTML = '<img data-ssg-lcp="true" src="/hero.webp">'
      const img = document.querySelector('img') as HTMLImageElement
      Object.defineProperty(img, 'complete', { configurable: true, value: true })

      runLoader()
      expect(calls).toHaveLength(1)
    })

    it('ошибка картинки шрифт не блокирует', () => {
      const calls = installFontLoadingApi()
      document.body.innerHTML = '<img data-lcp src="/broken.webp">'
      const img = document.querySelector('img') as HTMLImageElement
      Object.defineProperty(img, 'complete', { configurable: true, value: false })

      runLoader()
      img.dispatchEvent(new Event('error'))
      expect(calls).toHaveLength(1)
    })

    it('гидратация снимает ожидание: картинка своё окно уже получила', async () => {
      const calls = installFontLoadingApi()
      document.body.innerHTML = '<img data-lcp src="/slow.webp">'
      const img = document.querySelector('img') as HTMLImageElement
      Object.defineProperty(img, 'complete', { configurable: true, value: false })

      runLoader()
      expect(calls).toHaveLength(0)

      document.documentElement.classList.add('app-hydrated')
      await flush()
      expect(calls).toHaveLength(1)

      // Запоздалый load той же картинки второй запрос и второе правило не создаёт.
      img.dispatchEvent(new Event('load'))
      expect(calls).toHaveLength(1)
      expect(fontFaceRules()).toHaveLength(1)
    })

    describe('сбой загрузки шрифта', () => {
      const setOnline = (online: boolean) =>
        Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })

      afterEach(() => {
        setOnline(true)
      })

      it('без сети иконки остаются скрытыми, а правило объявляется заново по online', async () => {
        const calls = installFontLoadingApi()
        setOnline(false)
        runLoader()

        calls[0].reject()
        await flush()
        expect(isReady()).toBe(false)
        // Упавшую гарнитуру браузер не перезапрашивает — старое правило снято.
        expect(fontFaceRules()).toEqual([])
        expect(calls).toHaveLength(1)

        setOnline(true)
        window.dispatchEvent(new Event('online'))
        expect(fontFaceRules()).toEqual([EXPECTED_RULE])
        expect(calls).toHaveLength(2)
        calls[1].resolve()
        await flush()
        expect(isReady()).toBe(true)
      })

      it('в сети повторяет один раз сразу: обрыв соединения не оставляет страницу без иконок', async () => {
        const calls = installFontLoadingApi()
        runLoader()

        calls[0].reject()
        await flush()
        // События `online` при живой сети не будет — ждать его нельзя.
        expect(calls).toHaveLength(2)
        expect(fontFaceRules()).toEqual([EXPECTED_RULE])
        expect(isReady()).toBe(false)

        calls[1].resolve()
        await flush()
        expect(isReady()).toBe(true)
      })

      it('после второго сбоя в сети открывает иконки как есть, а не прячет их до перезагрузки', async () => {
        const calls = installFontLoadingApi()
        runLoader()

        calls[0].reject()
        await flush()
        calls[1].reject()
        await flush()

        // Блокировщик шрифтов, режим блокировки iOS: шрифта не будет, но кнопки
        // не должны остаться пустыми навсегда — показ ведёт запасной глиф, как до #2170.
        expect(isReady()).toBe(true)
        expect(fontFaceRules()).toEqual([EXPECTED_RULE])
        expect(calls).toHaveLength(2)
      })
    })

    it('без Font Loading API объявляет гарнитуру и сразу открывает иконки: показ ведёт font-display:block', () => {
      uninstallFontLoadingApi()
      runLoader()

      expect(fontFaceRules()).toEqual([EXPECTED_RULE])
      expect(isReady()).toBe(true)
    })

    it('не ставит таймеров: порядок держат события, а не ожидание', () => {
      const script = buildIconFontLoaderScript(FONT_URL)
      expect(script).not.toMatch(/setTimeout|setInterval|requestIdleCallback/)
    })
  })

  describe('font-display для гарнитур, которые expo-font дописывает в рантайме', () => {
    const insertStyle = async (css: string) => {
      const style = document.createElement('style')
      style.textContent = css
      document.head.appendChild(style)
      // MutationObserver в jsdom доставляет записи микрозадачей.
      await flush()
      return style.textContent
    }

    beforeEach(() => {
      // Исполняем тот же текст, что уйдёт в <script>.
      new Function(buildFontDisplayPolicyScript())()
    })

    it('иконочной гарнитуре ставит block: swap рисовал бы коды иконок запасным шрифтом', async () => {
      expect(await insertStyle('@font-face{font-family:"material-community";src:url("/mci.ttf");font-display:auto}')).toBe(
        '@font-face{font-family:"material-community";src:url("/mci.ttf");font-display:block}',
      )
      expect(await insertStyle('@font-face{font-family:feather;src:url("/f.ttf")}')).toBe(
        '@font-face{font-family:feather;src:url("/f.ttf");font-display:block;}',
      )
    })

    it('текстовой гарнитуре оставляет swap', async () => {
      expect(await insertStyle('@font-face{font-family:"Roboto";src:url("/r.ttf");font-display:auto}')).toBe(
        '@font-face{font-family:"Roboto";src:url("/r.ttf");font-display:swap}',
      )
    })

    it('не путает имя, которое лишь начинается с иконочного', async () => {
      expect(await insertStyle('@font-face{font-family:"feather-text";src:url("/t.ttf");font-display:auto}')).toBe(
        '@font-face{font-family:"feather-text";src:url("/t.ttf");font-display:swap}',
      )
    })
  })
})
