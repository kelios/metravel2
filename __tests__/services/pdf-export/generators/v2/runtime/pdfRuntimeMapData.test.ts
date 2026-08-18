/**
 * #1468, случай 2: подпись загруженного трека в PDF собиралась
 * `Math.round(distanceKm * 10) / 10` и печаталась английским «12.6 км» — то же
 * число, что блок «Профиль высот» на странице путешествия. После #1465
 * карточка «Дистанция» и ось X в PDF уже верные, а подпись трека отставала;
 * этот тест держит её через сам продовый `buildPdfMapRuntimeData` на RU и EN.
 */
import { buildPdfMapRuntimeData } from '@/services/pdf-export/generators/v2/runtime/pdfRuntimeMapData'
import { i18n } from '@/i18n'

jest.mock('@/api/travelRoutes', () => ({
  listTravelRouteFiles: jest.fn(async () => [
    { id: 7, ext: 'gpx', original_name: 'track.gpx' },
  ]),
  downloadTravelRouteFileBlob: jest.fn(async () => ({ text: '<gpx></gpx>' })),
}))

jest.mock('@/utils/routeFileParser', () => ({
  parseRouteFilePreview: jest.fn(() => ({
    linePoints: [
      { coord: '53.9,27.56' },
      { coord: '53.95,27.6' },
    ],
  })),
}))

const buildParams = () => ({
  travel: { id: 42 } as any,
  locations: [],
  buildRouteSvg: () => '<svg></svg>',
  calculateRouteDistanceFromPreview: () => 12.64,
  generateLocationQRCodes: async () => [],
  buildLocationCards: () => [],
  getLeafletRouteSnapshot: async () => async () => null,
})

describe('#1468 подпись загруженного трека в PDF идёт по нормам локали', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it.each([
    ['ru', '12,6 км'],
    ['en', '12.6 km'],
  ])('печатает дистанцию трека по локали %s', async (locale, distance) => {
    await i18n.changeLanguage(locale)

    const result = await buildPdfMapRuntimeData(buildParams())

    expect(result.routeInfo).toBe(`track.gpx • ${distance}`)
  })

  it('на RU не печатает английскую точку в километрах трека', async () => {
    await i18n.changeLanguage('ru')

    const result = await buildPdfMapRuntimeData(buildParams())

    expect(result.routeInfo).not.toMatch(/\d\.\d\s*км/)
  })
})
