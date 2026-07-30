import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ALL_CONTRACT_WIDTHS, IMAGE_QUALITY, IMAGE_WIDTHS } from '@/constants/imageContract'
import { optimizeImageUrl, snapProxyQuality, snapProxyWidth } from '@/utils/imageProxy'

/**
 * #1167: контракт размеров обязан быть исполняемым, а не только текстовым.
 *
 * Шесть тикетов подряд (#1104, #1112, #1113, #1120, #1103, #1170) — это один и тот
 * же дефект: фронт просил ширину, которой у прокси нет, и молча получал лишние байты
 * либо мастер целиком. Каждый чинился разовым `curl`, а вывод оседал комментарием и
 * устаревал. Здесь то же самое проверяется прогоном.
 *
 * Снимок ступеней — ответ `GET https://metravel.by/api/media/proxy-contract`
 * (`version: 2`) на 2026-07-30; он же зафиксирован в
 * `__tests__/utils/imageProxy.ladder.test.ts`, который сверяет с ним рантайм-лестницу.
 */
const BACKEND_CONTRACT_WIDTHS = [
  32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500,
]

describe('constants/imageContract — набор размеров исполняем (#1167)', () => {
  it('каждая ширина контракта — ступень лестницы прокси', () => {
    const offLadder = ALL_CONTRACT_WIDTHS.filter((w) => !BACKEND_CONTRACT_WIDTHS.includes(w))
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

  it('каждое quality контракта лежит на сетке шага 10 и не квантуется', () => {
    for (const [name, quality] of Object.entries(IMAGE_QUALITY)) {
      expect({ name, snapped: snapProxyQuality(quality) }).toEqual({ name, snapped: quality })
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
      ['тело статьи, 920 CSS @DPR2 (vw 1920)', 920, 2, IMAGE_WIDTHS.articleBodyDesktop],
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
  })
})
