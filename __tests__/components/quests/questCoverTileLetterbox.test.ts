// #1542: обложка квеста рисуется `contain` (docs/RULES.md → «Images and
// placeholders») в ФИКСИРОВАННОЙ квадратной плитке `QuestForCityCard`. Плитка
// живёт в горизонтальном рейле (главная, `QuestNextStepSection`,
// `QuestForCitySection`), поэтому слот из пропорций каждой обложки запрещён:
// это ровно тот рваный ряд, который владелец отклонил 2026-08-24 на карточках
// маршрутов (#1487).
//
// Значит плоское поле убирается только КОНТЕНТОМ — квадратным вариантом
// обложки (прецедент #134/#152). Тест фиксирует четыре края контракта:
//   1) слот остаётся квадратом и не зависит от пропорций конкретной обложки;
//   2) квадратный вариант обложки даёт 0% поля — путь решения рабочий;
//   3) потолок поля на текущей выдаче не может вырасти молча: обложка дальше
//      от квадрата, чем нынешний худший класс, роняет тест;
//   4) состояние долга зафиксировано: пока #1587 не заполнит square-поля,
//      порог ≤10% не берёт ни один квест. После backfill перезамер фикстуры
//      уронит именно этот пункт — его правят вместе с данными, а не задним числом.
//
// Фикстура — замер прода 2026-08-27 по всем 156 квестам. #1558 уже отдал
// nullable `src_square` / `variants.square_*`; значения пока null (#1587).
// Обновляется командой:
//   curl -s 'https://metravel.by/api/quests/?compact=1&page_size=300' \
//     | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{ \
//         const g={};JSON.parse(s).results.forEach(q=>{const c=q.media?.cover; \
//         if(c) g[c.aspect_ratio]=(g[c.aspect_ratio]||0)+1});console.log(g)})"

import {
  QUEST_TILE_MEDIA_HEIGHT,
  QUEST_TILE_MEDIA_HEIGHT_COMPACT,
  QUEST_TILE_MEDIA_SIZE,
  QUEST_TILE_MEDIA_SIZE_COMPACT,
  QUEST_TILE_SLOT_RATIO,
} from '@/components/quests/questCoverTileGeometry'

/**
 * Порог приёмки #1542: доля плоского поля с одной стороны плитки. Живёт в
 * тесте, а не в модуле геометрии: рантайм его не читает — это критерий
 * приёмки, достижимый только после квадратного варианта обложки от бэкенда.
 */
const TARGET_BAND_SHARE = 0.1

/**
 * Пропорции обложек квестов на проде. Замер 2026-08-27,
 * `/api/quests/?compact=1&page_size=300`, поле `media.cover.aspect_ratio`.
 * Квадратных обложек в выдаче НЕТ ни одной — весь набор ландшафтный.
 */
const PROD_COVER_RATIOS = [
  { label: '3:2 ландшафт (1200×800)', ratio: 1.5, quests: 65 },
  { label: '16:9 ландшафт (1200×675)', ratio: 16 / 9, quests: 52 },
  { label: '4:3 ландшафт (1200×900)', ratio: 4 / 3, quests: 37 },
  { label: '1.462 ландшафт (1200×821)', ratio: 1.461632, quests: 2 },
] as const

const PROD_COVER_TOTAL = 156

/**
 * Потолок поля на текущей выдаче: его задаёт самый далёкий от квадрата класс
 * (16:9) — (1 − 1/1.778)/2 = 21.9%. Карточка #1542 знала 16.9%, потому что
 * замер 2026-08-23 видел только шесть квестов из двух рейлов; по всей выдаче
 * потолок выше.
 */
const CURRENT_BAND_CEILING = (1 - 1 / (16 / 9)) / 2 + 0.0005

/**
 * Доля плоского поля с одной стороны — ровно та метрика, которой замеряет
 * браузерная приёмка: `(slotHeight − renderedBitmapHeight) / 2 / slotHeight`
 * над `img[object-fit=contain]`.
 */
function measureBandShares(aspectRatio: number) {
  const slotWidth = QUEST_TILE_MEDIA_SIZE
  const slotHeight = QUEST_TILE_MEDIA_HEIGHT
  const renderedWidth = Math.min(slotWidth, slotHeight * aspectRatio)
  const renderedHeight = Math.min(slotHeight, slotWidth / aspectRatio)
  return {
    bandShare: (slotHeight - renderedHeight) / 2 / slotHeight,
    sideShare: (slotWidth - renderedWidth) / 2 / slotWidth,
  }
}

describe('#1542 летербокс обложки квеста в квадратной плитке', () => {
  it('слот плитки — квадрат и не зависит от пропорций обложки', () => {
    // Инвариант рейла: высота плитки — константа, а не функция кадра. Уход
    // отсюда даст соседям в одном ряду разную высоту — вид, отклонённый
    // владельцем 2026-08-24 (#1487).
    expect(QUEST_TILE_SLOT_RATIO).toBe(1)
    expect(QUEST_TILE_MEDIA_HEIGHT).toBe(QUEST_TILE_MEDIA_SIZE)
  })

  it('телефонная плитка #1673 — тот же квадрат, только меньшей стороной', () => {
    // Компактная сторона (#1673) не должна стать вторым, независимым слотом:
    // доля поля считается от пропорции, поэтому уход компактной плитки из
    // квадрата тихо вернул бы летербокс, который закрыт #1542.
    expect(QUEST_TILE_MEDIA_HEIGHT_COMPACT).toBe(QUEST_TILE_MEDIA_SIZE_COMPACT)
    expect(QUEST_TILE_MEDIA_SIZE_COMPACT).toBeLessThan(QUEST_TILE_MEDIA_SIZE)
  })

  it('квадратный вариант обложки укладывается в порог без поля вовсе', () => {
    // Путь решения #1542: манифест отдаёт плитке квадратный вариант обложки
    // (прецедент #134/#152). Тогда `contain` не летербоксит — поля нет.
    const { bandShare, sideShare } = measureBandShares(1)
    expect(bandShare).toBeCloseTo(0, 5)
    expect(sideShare).toBeCloseTo(0, 5)
    expect(Math.max(bandShare, sideShare)).toBeLessThanOrEqual(TARGET_BAND_SHARE)
  })

  it('поле на прод-выдаче не может вырасти выше измеренного потолка', () => {
    // Регресс-контроль перезамера: обложка дальше от квадрата, чем нынешний
    // худший класс (16:9), роняет тест — например портретный кадр или
    // ландшафт шире 16:9. Квадратность самого слота держат тесты выше: уход
    // слота В ЛАНДШАФТ поле не увеличит, поэтому здесь он не ловится.
    const offenders: string[] = []
    for (const cover of PROD_COVER_RATIOS) {
      const { bandShare, sideShare } = measureBandShares(cover.ratio)
      const worst = Math.max(bandShare, sideShare)
      if (worst > CURRENT_BAND_CEILING) {
        offenders.push(`${cover.label}: ${(worst * 100).toFixed(1)}%`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('фикстура выдачи зафиксирована: сегодня порог ≤10% не берёт ни один квест', () => {
    // Состояние долга, снятое с прода 2026-08-27. Тест обязан упасть, когда
    // #1587 заполнит квадратный вариант: тогда `withinTarget` станет 156, и
    // число правится вместе с данными, а не задним числом.
    const total = PROD_COVER_RATIOS.reduce((sum, cover) => sum + cover.quests, 0)
    const withinTarget = PROD_COVER_RATIOS.filter((cover) => {
      const { bandShare, sideShare } = measureBandShares(cover.ratio)
      return Math.max(bandShare, sideShare) <= TARGET_BAND_SHARE
    }).reduce((sum, cover) => sum + cover.quests, 0)

    expect(total).toBe(PROD_COVER_TOTAL)
    expect(withinTarget).toBe(0)
  })
})
