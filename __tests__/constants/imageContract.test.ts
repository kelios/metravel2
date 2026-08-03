import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  ALL_CONTRACT_WIDTHS,
  ALL_STORED_IMAGE_WIDTHS,
  IMAGE_QUALITY,
  IMAGE_STORAGE_FORMAT,
  IMAGE_STORAGE_POLICY_V1,
  IMAGE_STORAGE_POLICY_VERSION,
  IMAGE_WIDTHS,
} from '@/constants/imageContract'
import {
  optimizeImageUrl,
  PROXY_QUALITY_LADDER,
  snapProxyQuality,
  snapProxyWidth,
} from '@/utils/imageProxy'

/**
 * #1167: контракт размеров обязан быть исполняемым, а не только текстовым.
 *
 * Шесть тикетов подряд (#1104, #1112, #1113, #1120, #1103, #1170) — это один и тот
 * же дефект: фронт просил ширину, которой у прокси нет, и молча получал лишние байты
 * либо мастер целиком. Каждый чинился разовым `curl`, а вывод оседал комментарием и
 * устаревал. Здесь то же самое проверяется прогоном.
 *
 * Снимок ступеней — ответ `GET https://metravel.by/api/media/proxy-contract`
 * (`version: 3`) на 2026-08-02; он же зафиксирован в
 * `__tests__/utils/imageProxy.ladder.test.ts`, который сверяет с ним рантайм-лестницу.
 */
const BACKEND_CONTRACT_WIDTHS = [
  32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500,
]

describe('constants/imageContract — набор размеров исполняем (#1167)', () => {
  it('каждая frontend- и storage-ширина — ступень лестницы прокси', () => {
    const offLadder = [...ALL_CONTRACT_WIDTHS, ...ALL_STORED_IMAGE_WIDTHS].filter(
      (w) => !BACKEND_CONTRACT_WIDTHS.includes(w),
    )
    expect(offLadder).toEqual([])
  })

  // Ширина, не совпадающая со ступенью, снэпится вверх — то есть фронт получает
  // не тот файл, который перечислил. Для контракта это недопустимо: он и существует,
  // чтобы бэкенд мог предгенерировать ровно перечисленное.
  it('ни одна ширина контракта не снэпится: запрошенное = полученное', () => {
    for (const width of ALL_CONTRACT_WIDTHS) {
      expect({ width, snapped: snapProxyWidth(width) }).toEqual({ width, snapped: width })
    }
  })

  it('каждое quality контракта — явная ступень proxy-contract и не квантуется', () => {
    for (const [name, quality] of Object.entries(IMAGE_QUALITY)) {
      expect(PROXY_QUALITY_LADDER).toContain(quality)
      expect({ name, snapped: snapProxyQuality(quality) }).toEqual({ name, snapped: quality })
    }
  })

  it('разделяет target S3 policy и переходный proxy-contract', () => {
    expect({ version: IMAGE_STORAGE_POLICY_VERSION, format: IMAGE_STORAGE_FORMAT }).toEqual({
      version: 1,
      format: 'webp',
    })

    expect(IMAGE_STORAGE_POLICY_V1.travelMedia.master).toEqual({ width: 2500, quality: 85 })
    expect(IMAGE_STORAGE_POLICY_V1.articleBody.master).toEqual({ width: 1920, quality: 85 })
    expect(IMAGE_STORAGE_POLICY_V1.questCover).toMatchObject({
      master: { width: 1200, quality: 85 },
      derivatives: [
        { width: 320, quality: 60 },
        { width: 480, quality: 60 },
        { width: 640, quality: 60 },
        { width: 800, quality: 60 },
      ],
    })
    expect(IMAGE_QUALITY.print).toBe(85)
    // Ступень 96 остаётся в policy как обычный thumb травела. Отдельного
    // `heroBackdrop` (w=96 q40) больше нет — подложку, ради которой он
    // существовал, сняли в #1208/#1209.
    expect(IMAGE_STORAGE_POLICY_V1.travelMedia.derivatives).toContainEqual({
      width: 96,
      quality: IMAGE_QUALITY.small,
    })
  })

  it('в каждом storage-profile мастер один, а производные уникальны и отсортированы', () => {
    for (const [name, profile] of Object.entries(IMAGE_STORAGE_POLICY_V1)) {
      const derivativeWidths = profile.derivatives.map((variant) => variant.width)
      expect({ name, derivativeWidths }).toEqual({
        name,
        derivativeWidths: [...new Set(derivativeWidths)].sort((a, b) => a - b),
      })
      expect({ name, includesMaster: derivativeWidths.includes(profile.master.width) }).toEqual({
        name,
        includesMaster: false,
      })
      for (const variant of [profile.master, ...profile.derivatives]) {
        expect(PROXY_QUALITY_LADDER).toContain(variant.quality)
      }
    }
  })

  /**
   * Раньше здесь допускалась и ширина мастера — и ровно этим просочился дефект
   * 2026-08-03: `articleBodyDesktop` заканчивался на 1920, то есть на мастере
   * профиля `articleBody`. Пока backend умел динамический resize, такой запрос
   * обслуживался; после включения `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED` чтение
   * стало fail-closed и мастер через `?w=` отвечает 400 — на desktop @DPR2
   * браузер брал из srcset именно 1920, и фото тела статьи не грузились совсем.
   *
   * Поэтому запрашивать разрешено только ПРОИЗВОДНЫЕ. Единственное исключение —
   * `printFull`: печать намеренно берёт мастер травела (2500), и прод отдаёт его
   * `stored-master` 200.
   */
  it('ключевые frontend-наборы покрыты производными своего storage-profile, а не мастером', () => {
    const widthsOf = (profile: (typeof IMAGE_STORAGE_POLICY_V1)[keyof typeof IMAGE_STORAGE_POLICY_V1]) =>
      new Set(profile.derivatives.map((variant) => variant.width))

    const article = widthsOf(IMAGE_STORAGE_POLICY_V1.articleBody)
    const travel = widthsOf(IMAGE_STORAGE_POLICY_V1.travelMedia)
    const quest = widthsOf(IMAGE_STORAGE_POLICY_V1.questCover)

    for (const width of [
      ...IMAGE_WIDTHS.articleBodyMobile,
      ...IMAGE_WIDTHS.articleBodyDesktop,
    ]) {
      expect({ surface: 'articleBody', width, stored: article.has(width) }).toEqual({
        surface: 'articleBody',
        width,
        stored: true,
      })
    }
    for (const width of [
      ...IMAGE_WIDTHS.travelHeroMobile,
      ...IMAGE_WIDTHS.travelHeroDesktop,
      IMAGE_WIDTHS.printInline,
    ]) {
      expect({ surface: 'travelMedia', width, stored: travel.has(width) }).toEqual({
        surface: 'travelMedia',
        width,
        stored: true,
      })
    }

    // Единственный осознанный запрос мастера: печать берёт травел целиком.
    expect({ printFull: IMAGE_WIDTHS.printFull }).toEqual({
      printFull: IMAGE_STORAGE_POLICY_V1.travelMedia.master.width,
    })
    for (const width of IMAGE_WIDTHS.questCover) {
      expect({ surface: 'questCover', width, stored: quest.has(width) }).toEqual({
        surface: 'questCover',
        width,
        stored: true,
      })
    }
  })

  // Наборы разъезжались именно потому, что жили литералами в четырёх файлах.
  it('в коде фич не осталось собственных списков ширин', () => {
    const root = resolve(__dirname, '..', '..')
    const sources = [
      'components/travel/stableContent/htmlTransform.ts',
      'components/travel/details/TravelDetailsOptimizedLCPHero.tsx',
      'screens/tabs/QuestCard.tsx',
      'utils/printImageUrl.ts',
    ]
    for (const file of sources) {
      const content = readFileSync(resolve(root, file), 'utf8')
      // Литеральный массив из трёх и более трёх-четырёхзначных чисел — это набор ширин.
      const literalWidthArrays = content.match(/\[\s*\d{3,4}\s*(?:,\s*\d{3,4}\s*){2,}\]/g) ?? []
      expect({ file, literalWidthArrays }).toEqual({ file, literalWidthArrays: [] })
    }
  })

  describe('перечисленные наборы покрывают реальные слоты', () => {
    const previousApiUrl = process.env.EXPO_PUBLIC_API_URL

    beforeEach(() => {
      process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    })

    afterAll(() => {
      process.env.EXPO_PUBLIC_API_URL = previousApiUrl
    })

    const requestedWidth = (slotCss: number, dpr: number) =>
      Number(
        new URL(
          optimizeImageUrl('https://metravel.by/gallery/1/gallery/x.webp', {
            width: Math.round(slotCss * dpr),
          })!,
        ).searchParams.get('w'),
      )

    /**
     * Проверяемое свойство — то, по которому браузер выбирает кандидата из `srcset`:
     * в наборе класса обязан быть кандидат НЕ МЕНЬШЕ нужного (иначе картинка
     * апскейлится и выглядит мыльной — дефект #1160), и перелёт не должен быть
     * большим (иначе слот платит за пиксели, которых не видно — дефект #1170, где
     * между 640 и 1280 не было ничего и слот 780 брал 1280, 132 344 B вместо 53 104).
     *
     * Точного совпадения не требуем: 720 CSS @DPR1 закрывается кандидатом 800 с
     * перелётом 11%, и отдельная ступень 720 в наборе тела статьи не окупается.
     */
    const MAX_OVERSHOOT = 1.35

    it.each([
      ['тело статьи, 390 CSS @DPR2', 390, 2, IMAGE_WIDTHS.articleBodyMobile],
      ['тело статьи, 720 CSS @DPR1 (vw 1280)', 720, 1, IMAGE_WIDTHS.articleBodyDesktop],
      ['тело статьи, 720 CSS @DPR2 (vw 1280)', 720, 2, IMAGE_WIDTHS.articleBodyDesktop],
      ['тело статьи, 920 CSS @DPR1 (vw 1920)', 920, 1, IMAGE_WIDTHS.articleBodyDesktop],
      ['hero травела, 360 CSS @DPR2', 360, 2, IMAGE_WIDTHS.travelHeroMobile],
      ['hero травела, 1280 CSS @DPR1', 1280, 1, IMAGE_WIDTHS.travelHeroDesktop],
      ['обложка квеста, 380 CSS @DPR2', 380, 2, IMAGE_WIDTHS.questCover],
    ])('%s покрыт набором класса без апскейла и без большого перелёта', (_name, slotCss, dpr, set) => {
      const needed = requestedWidth(slotCss, dpr)
      const candidate = [...set].sort((a, b) => a - b).find((w) => w >= needed) ?? Math.max(...set)

      expect({ needed, candidate, upscales: candidate < needed }).toEqual({
        needed,
        candidate,
        upscales: false,
      })
      expect({ needed, candidate, overshoot: candidate / needed <= MAX_OVERSHOOT }).toEqual({
        needed,
        candidate,
        overshoot: true,
      })
    })

    /**
     * Единственный слот, который упирается в потолок семейства: 920 CSS на вьюпорте
     * 1920 при DPR2 просит 1840, а самая широкая ПРОИЗВОДНАЯ `articleBody` — 1600.
     *
     * Раньше набор закрывал этот слот мастером 1920, и после перехода backend на
     * fail-closed чтение производных такой запрос стал отвечать 400 (замер прода
     * 2026-08-03: `w=1600` → 200 stored-derivative, `w=1920` → 400) — фото тела
     * статьи не отрисовывались на desktop @DPR2 вовсе. Управляемый апскейл ×1.2
     * лучше битой картинки; вернуть 1:1 можно только производной 1920 на backend
     * (#1215), но не запросом мастера.
     */
    it('тело статьи, 920 CSS @DPR2 (vw 1920) упирается в потолок производных, а не в мастер', () => {
      const set = IMAGE_WIDTHS.articleBodyDesktop
      const needed = requestedWidth(920, 2)
      const candidate = [...set].sort((a, b) => a - b).find((w) => w >= needed) ?? Math.max(...set)
      const widestDerivative = Math.max(
        ...IMAGE_STORAGE_POLICY_V1.articleBody.derivatives.map((variant) => variant.width),
      )

      expect({ needed, candidate, widestDerivative }).toEqual({
        needed: 1920,
        candidate: 1600,
        widestDerivative: 1600,
      })
      expect({ upscale: needed / candidate <= 1.2 }).toEqual({ upscale: true })
      expect(set).not.toContain(IMAGE_STORAGE_POLICY_V1.articleBody.master.width)
    })
  })
})
