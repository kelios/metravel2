// #1541: hero главной рисует ВЕСЬ набор `BOOK_IMAGES` в одном кадре с
// кросс-фейдом, поэтому приём #1487 (слот от пропорции конкретной обложки)
// здесь запрещён — кадр дёргался бы на каждом автопереключении. Лечится не
// слот, а набор: пропорция кадра — константа (`HOME_HERO_MEDIA_SLOT_RATIO`),
// а слайды нормализованы под неё.
//
// Тест фиксирует оба края контракта:
//   1) кадр: пропорция одна на весь набор и одна на всех брейкпоинтах —
//      геометрия hero не зависит от того, какой слайд сейчас видно;
//   2) поле: под `contain` (docs/RULES.md → «Images and placeholders») ни один
//      слайд не даёт плоского поля шире `HOME_HERO_MAX_FLAT_SHARE` ни с одной
//      стороны. До фикса было до 29.5% (mobile 390) и 14.7% (desktop 1280).
//
// Пропорции локальных ассетов читаются из самих файлов, а не из объявления:
// иначе тест проверял бы поле у числа, которое сам же и взял из кода.

import fs from 'fs'
import path from 'path'

import { BOOK_IMAGES } from '@/components/home/homeHeroContent'
import {
  HOME_HERO_MAX_FLAT_SHARE,
  HOME_HERO_MEDIA_SLOT_RATIO,
} from '@/components/home/homeHeroShared'

/**
 * Ширины слота с прод-замеров 2026-08-23/25 — по одной на каждую поверхность,
 * где рисуется `BOOK_IMAGES`. Высоту слота на всех трёх задаёт та же
 * `HOME_HERO_MEDIA_SLOT_RATIO`, поэтому доля поля от ширины не зависит; список
 * держится, чтобы падение сразу называло экран.
 */
const PROD_SLOT_WIDTHS = [
  { label: 'слайдер книги, desktop 1280', width: 365 },
  { label: 'крупная карточка, mobile 390', width: 358 },
  { label: 'карточка популярного, mobile 390', width: 172 },
] as const

/** Локальные ассеты набора: имя файла → пропорция читается с диска. */
const LOCAL_ASSET_FILES = [
  'cover_sorapiso.webp',
  'cover_trecime.webp',
  'cover_bled.webp',
  'cover_morskoe_oko.webp',
] as const

/**
 * Удалённый слайд нельзя декодировать в hermetic Jest без сетевого запроса.
 * Поэтому фиксируем отдельно измеренную immutable conversion-ссылку и её
 * пропорцию: смена URL теперь требует явного перезамера, а не может остаться
 * зелёной только потому, что `aspectRatio` в `BOOK_IMAGES` забыли обновить.
 */
const REMOTE_ASSET_MEASUREMENTS = [
  {
    uri: 'https://metravel.by/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp',
    aspectRatio: 4 / 3,
  },
] as const

/**
 * Размер кадра WebP по заголовку контейнера. Полноценный декодер тут не нужен,
 * а лишняя зависимость в тесте — лишний источник падений.
 */
function readWebpSize(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file)
  expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(buf.subarray(8, 12).toString('ascii')).toBe('WEBP')

  const chunk = buf.subarray(12, 16).toString('ascii')
  if (chunk === 'VP8X') {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  }
  if (chunk === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  throw new Error(`${path.basename(file)}: неизвестный WebP-чанк ${chunk}`)
}

/** Доли поля так, как их считает браузерная приёмка над `img[object-fit=contain]`. */
function measureFlatShares(slotWidth: number, aspectRatio: number) {
  const slotHeight = slotWidth / HOME_HERO_MEDIA_SLOT_RATIO
  const renderedWidth = Math.min(slotWidth, slotHeight * aspectRatio)
  const renderedHeight = Math.min(slotHeight, slotWidth / aspectRatio)
  return {
    sideShare: (slotWidth - renderedWidth) / 2 / slotWidth,
    bandShare: (slotHeight - renderedHeight) / 2 / slotHeight,
  }
}

describe('#1541 единый ландшафтный кадр hero главной', () => {
  it('кадр один на весь набор — автопереключение не двигает геометрию', () => {
    // Инвариант кадра: пропорция — константа, не функция слайда. Если она
    // снова станет считаться от `aspectRatio` конкретной обложки, hero начнёт
    // прыгать на каждом переключении, и это падение — суть карточки, а не
    // деталь реализации.
    expect(HOME_HERO_MEDIA_SLOT_RATIO).toBe(3 / 2)
  })

  it('каждый слайд объявляет пропорцию — вслепую слайд в набор не попадёт', () => {
    expect(BOOK_IMAGES.length).toBeGreaterThan(0)
    for (const slide of BOOK_IMAGES) {
      expect(Number.isFinite(slide.aspectRatio)).toBe(true)
      expect(slide.aspectRatio).toBeGreaterThan(0)
    }
  })

  it('объявленная пропорция локальных ассетов совпадает с растром на диске', () => {
    // Jest мапит локальные WebP в строку `test-file-stub`, тогда как
    // React Native в runtime даёт им numeric asset id. Стабильная граница
    // здесь — remote `{ uri }`, а не конкретный тип локального source.
    const declared = BOOK_IMAGES.filter(
      (slide) =>
        !slide.source ||
        typeof slide.source !== 'object' ||
        typeof (slide.source as { uri?: unknown }).uri !== 'string',
    )
    expect(declared).toHaveLength(LOCAL_ASSET_FILES.length)

    for (const [index, fileName] of LOCAL_ASSET_FILES.entries()) {
      const file = path.join(process.cwd(), 'assets', 'images', fileName)
      const { width, height } = readWebpSize(file)
      // Проверяем и сам растр, и объявление слайда: иначе тест мог бы
      // позеленеть при неверном `aspectRatio` в BOOK_IMAGES.
      const rasterRatio = width / height
      expect(rasterRatio).toBeCloseTo(HOME_HERO_MEDIA_SLOT_RATIO, 2)
      expect(declared[index]?.aspectRatio).toBeCloseTo(rasterRatio, 2)
    }
  })

  it('удалённые слайды остаются на отдельно измеренных immutable conversion-файлах', () => {
    const remote = BOOK_IMAGES.filter(
      (slide) =>
        !!slide.source &&
        typeof slide.source === 'object' &&
        typeof (slide.source as { uri?: unknown }).uri === 'string',
    ).map((slide) => ({
      uri: (slide.source as { uri: string }).uri,
      aspectRatio: slide.aspectRatio,
    }))

    expect(remote).toEqual(REMOTE_ASSET_MEASUREMENTS)
  })

  it('ни один слайд не даёт плоского поля шире потолка', () => {
    const overflowing: string[] = []

    for (const slot of PROD_SLOT_WIDTHS) {
      for (const [index, slide] of BOOK_IMAGES.entries()) {
        const { sideShare, bandShare } = measureFlatShares(slot.width, slide.aspectRatio)
        const worst = Math.max(sideShare, bandShare)
        if (worst > HOME_HERO_MAX_FLAT_SHARE) {
          overflowing.push(
            `${slot.label}: слайд #${index} (${slide.aspectRatio.toFixed(3)}) — ` +
              `бок ${(sideShare * 100).toFixed(1)}%, полоса ${(bandShare * 100).toFixed(1)}%`,
          )
        }
      }
    }

    expect(overflowing).toEqual([])
  })

  it('портретный слайд в набор не проходит — это и был баг #1541', () => {
    // Страховка от «тест зелёный, потому что ничего не считает»: вернём в набор
    // прежний вертикальный кадр 2:3 и убедимся, что проверка его валит. На
    // прод-слоте mobile 390 он даёт 27.8% (замер 2026-08-23 дал 29.5% —
    // тогдашний слот 358×220 был ещё и не 3:2).
    const { sideShare } = measureFlatShares(358, 2 / 3)
    expect(sideShare).toBeGreaterThan(HOME_HERO_MAX_FLAT_SHARE)
    expect(+(sideShare * 100).toFixed(1)).toBe(27.8)
  })
})
