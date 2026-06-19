// __tests__/services/pdf-export/htmlPreviewArtifacts.test.ts
// Генератор HTML-образцов книги для визуальной проверки тем и водяного знака.
// Запуск: npx jest __tests__/services/pdf-export/htmlPreviewArtifacts.test.ts --runTestsByPath
// Результат: готовые HTML-документы в .tmp-pdf-preview/ в корне репо.

import fs from 'fs'
import path from 'path'

import { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator'
import type { TravelForBook } from '@/types/pdf-export'
import type { BookSettings } from '@/components/export/BookSettingsModal'

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('qr-data')),
}))

jest.mock('@/utils/mapImageGenerator', () => ({
  generateCanvasMapSnapshot: jest.fn(() => Promise.resolve('canvas-snapshot')),
  generateLeafletRouteSnapshot: jest.fn(() => Promise.resolve('leaflet-snapshot')),
  generateStaticMapUrl: jest.fn(() => 'https://staticmap.example.com/mock'),
  fetchImageAsDataUri: jest.fn(() => Promise.resolve(null)),
}))

jest.mock('@/services/pdf-export/quotes/travelQuotes', () => ({
  pickRandomQuote: jest.fn(() => ({ text: 'Путешествие меняет нас', author: 'Аноним' })),
  pickRandomGalleryQuote: jest.fn(() => ({ text: 'Каждый кадр — это история' })),
}))

const OUT_DIR = path.resolve(__dirname, '../../../.tmp-pdf-preview')

// Реальные фото из прод-галереи путешествия 638 + заглушки picsum, чтобы
// галерейные страницы были наполнены.
const PHOTO_URLS = [
  'https://picsum.photos/seed/metravel1/1200/800',
  'https://picsum.photos/seed/metravel2/1200/800',
  'https://picsum.photos/seed/metravel3/800/1200',
  'https://picsum.photos/seed/metravel4/1200/800',
  'https://picsum.photos/seed/metravel5/1200/900',
  'https://picsum.photos/seed/metravel6/900/1200',
]

const LONG_DESCRIPTION = `
<h2>Утро у воды</h2>
<p>Мы выехали затемно, чтобы застать туман над озером. Дорога шла вдоль кромки
леса, и каждый поворот открывал новый ракурс на холмы. К рассвету небо
окрасилось в тёплые тона, а вода стала зеркально-гладкой.</p>
<p>Местные рассказывали, что весной сюда прилетают журавли. Мы их не застали,
зато встретили рыбаков, которые угостили нас горячим чаем из термоса.</p>
<h3>Что взять с собой</h3>
<ul><li>Тёплую куртку — у воды прохладно даже летом</li>
<li>Термос и перекус</li>
<li>Камеру с запасным аккумулятором</li></ul>
<p>Обратный путь занял меньше времени: солнце уже стояло высоко, и пейзаж
выглядел совсем иначе, чем на рассвете.</p>
`.trim()

const travel: TravelForBook = {
  id: 638,
  name: 'Вода Беларуси: рассвет на озере',
  slug: 'voda-belarusi',
  url: 'https://metravel.by/travels/voda-belarusi',
  description: LONG_DESCRIPTION,
  recommendation: 'Приезжайте на рассвете в будний день — людей почти нет.',
  plus: 'Тихо, красиво, бесплатно',
  minus: 'Нет инфраструктуры, нужна своя еда',
  countryName: 'Беларусь',
  cityName: 'Минская область',
  year: '2023',
  monthName: 'Май',
  number_days: 1,
  userName: 'metravel',
  travel_image_thumb_url: PHOTO_URLS[0],
  travel_image_url: PHOTO_URLS[0],
  gallery: PHOTO_URLS.map((url, i) => ({ url, id: i + 1 })),
  travelAddress: [
    {
      id: '1',
      address: 'Озеро Нарочь',
      coord: '54.8667,26.7333',
      travelImageThumbUrl: PHOTO_URLS[1],
      categoryName: 'Природа',
    },
    {
      id: '2',
      address: 'Голубые озёра',
      coord: '54.9167,26.5500',
      travelImageThumbUrl: PHOTO_URLS[2],
      categoryName: 'Природа',
    },
  ],
}

const baseSettings: BookSettings = {
  title: 'Путешествия по воде',
  subtitle: 'Беларусь, 2023',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  includeChecklists: true,
  checklistSections: ['clothing', 'electronics'],
  showCoordinatesOnMapPage: true,
  galleryLayout: 'grid',
  galleryColumns: 3,
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}

interface PremiumGenerator {
  selectedQuotes?: unknown
  generate: (
    travels: TravelForBook[],
    settings: BookSettings,
    options?: { isPremium?: boolean },
  ) => Promise<string>
}

async function buildHtml(
  template: BookSettings['template'],
  isPremium: boolean,
): Promise<string> {
  const gen = new EnhancedPdfGenerator(template) as unknown as PremiumGenerator
  gen.selectedQuotes = undefined
  return gen.generate([travel], { ...baseSettings, template }, { isPremium })
}

const ARTIFACTS: Array<{
  file: string
  template: BookSettings['template']
  isPremium: boolean
}> = [
  { file: 'free-minimal.html', template: 'minimal', isPremium: true },
  { file: 'free-minimal-watermark.html', template: 'minimal', isPremium: false },
  { file: 'premium-travel-magazine.html', template: 'travel-magazine', isPremium: true },
  { file: 'premium-romantic.html', template: 'romantic', isPremium: true },
  { file: 'premium-editorial-luxe.html', template: 'editorial-luxe', isPremium: true },
  { file: 'premium-watercolor.html', template: 'watercolor', isPremium: true },
]

describe('HTML preview artifacts (.tmp-pdf-preview/)', () => {
  let warnSpy: jest.SpyInstance

  beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    fs.mkdirSync(OUT_DIR, { recursive: true })
  })

  afterAll(() => {
    warnSpy.mockRestore()
  })

  it.each(ARTIFACTS)('writes $file', async ({ file, template, isPremium }) => {
    const html = await buildHtml(template, isPremium)
    fs.writeFileSync(path.join(OUT_DIR, file), html, 'utf8')

    expect(html.length).toBeGreaterThan(1000)
    expect(html).toContain('<html')
    if (isPremium) {
      expect(html).not.toContain('metravel-watermark')
    } else {
      expect(html).toContain('metravel-watermark')
    }
  })

  it('produced all 6 files', () => {
    for (const { file } of ARTIFACTS) {
      expect(fs.existsSync(path.join(OUT_DIR, file))).toBe(true)
    }
  })
})
