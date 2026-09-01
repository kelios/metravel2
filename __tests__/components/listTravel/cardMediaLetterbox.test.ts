// #1487 (пересмотр 2026-08-24): карточка маршрута кадрирует обложку `contain`
// (`docs/RULES.md` → «Images and placeholders»), а медиа-слот ЕДИНЫЙ квадратный —
// решение владельца: каталог обязан быть ровной сеткой одинаковых карточек.
// Первый заход #1487 (слот из пропорций обложки) убирал поле в ноль, но ломал
// выравнивание рядов и был отклонён.
//
// Тест фиксирует оба края контракта:
//   1) сетка: слот не зависит от пропорций конкретной обложки;
//   2) поле: на моде прод-контента (квадратные обложки, 80% выдачи) поле 0%,
//      а на остатке не превышает измеренного потолка — расти ему некуда.

import fs from 'node:fs'
import path from 'node:path'

import {
  CARD_MEDIA_SLOT_RATIO,
  resolveCoverSlotGeometry,
} from '@/components/listTravel/travelListItemHelpers'

/**
 * Соотношения сторон обложек прод-выдачи. Замер 2026-08-23 по всем 360
 * опубликованным маршрутам `/api/travels/?publish=1`.
 */
const PROD_COVER_RATIOS = [
  { label: '9:16 портрет', ratio: 0.563, travels: 1 },
  { label: '3:4 портрет', ratio: 0.75, travels: 13 },
  { label: '1:1 квадрат', ratio: 1, travels: 288 },
  { label: '4:3 ландшафт', ratio: 4 / 3, travels: 37 },
  { label: '3:2 ландшафт', ratio: 1.5013, travels: 1 },
  { label: '16:9 ландшафт', ratio: 16 / 9, travels: 20 },
] as const

/** Ширины медиа-слота с прод-замеров: каталог desktop/mobile, главная, рейл. */
const PROD_SLOT_WIDTHS = [
  { label: 'каталог desktop 1280', width: 396 },
  { label: 'каталог mobile 390', width: 368 },
  { label: 'главная, крупная карточка', width: 643 },
  { label: 'главная, карточка стека', width: 454 },
  { label: 'рейл главной', width: 298 },
] as const

/**
 * Максимум доли плоского поля с одной стороны при квадратном слоте — задаёт
 * его самая далёкая от квадрата пропорция выдачи (9:16 и 16:9): (1 − 0.563)/2.
 * Выше этой планки поле уехать не может, пока слот квадратный.
 */
const MAX_FLAT_SHARE_TAIL = (1 - 0.563) / 2 + 0.001

/** Доли поля так, как их считает браузерная приёмка. */
function measureFlatShares(slotWidth: number, aspectRatio: number) {
  const slotHeight = slotWidth / CARD_MEDIA_SLOT_RATIO
  const { renderedWidth } = resolveCoverSlotGeometry({
    slotWidth,
    slotHeight,
    aspectRatio,
  })
  const renderedHeight = Math.min(slotHeight, slotWidth / aspectRatio)
  return {
    sideShare: ((slotWidth - (renderedWidth as number)) / 2) / slotWidth,
    bandShare: (slotHeight - renderedHeight) / 2 / slotHeight,
  }
}

describe('#1487 единый квадратный медиа-слот карточки маршрута', () => {
  it('слот один для всех обложек — сетка не может разъехаться', () => {
    // Инвариант сетки: пропорции слота — константа, не функция обложки.
    // Если слот снова станет считаться от `aspect_ratio`, ряды каталога
    // получат разную высоту, и это падение — прямое решение владельца
    // 2026-08-24, а не деталь реализации.
    expect(CARD_MEDIA_SLOT_RATIO).toBe(1)
  })

  it('мода прод-выдачи (квадратные обложки) не оставляет поля вовсе', () => {
    for (const slot of PROD_SLOT_WIDTHS) {
      const { sideShare, bandShare } = measureFlatShares(slot.width, 1)
      expect(sideShare).toBeCloseTo(0, 3)
      expect(bandShare).toBeCloseTo(0, 3)
    }
  })

  it('поле на остатке выдачи не превышает измеренного потолка', () => {
    // 4:3 и 3:4 → 12.5%; 3:2 → 16.7%; 16:9 и 9:16 → 21.9%. Это контентный
    // долг (квадратные варианты обложек, прецедент #134/#152), но потолок
    // закреплён: если слот дрейфанёт от квадрата, худшая доля вырастет и тест
    // упадёт раньше, чем полосы вернутся на большинство карточек.
    const offenders: string[] = []
    for (const slot of PROD_SLOT_WIDTHS) {
      for (const cover of PROD_COVER_RATIOS) {
        const { sideShare, bandShare } = measureFlatShares(slot.width, cover.ratio)
        const worst = Math.max(sideShare, bandShare)
        if (worst > MAX_FLAT_SHARE_TAIL) {
          offenders.push(
            `${slot.label} (${slot.width}px) × ${cover.label}: ${(worst * 100).toFixed(1)}%`,
          )
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('большинство выдачи остаётся в пороге ≤10% тикета #1487', () => {
    // Взвешенная по числу маршрутов доля карточек с полем >10%: только
    // не-квадратный хвост. Рост выше 20% значит, что либо слот уехал от моды,
    // либо мода контента сменилась — оба случая требуют пересмотра, а не
    // тихого прохода.
    const total = PROD_COVER_RATIOS.reduce((sum, c) => sum + c.travels, 0)
    const over10 = PROD_COVER_RATIOS.filter((c) => {
      const { sideShare, bandShare } = measureFlatShares(396, c.ratio)
      return Math.max(sideShare, bandShare) > 0.1
    }).reduce((sum, c) => sum + c.travels, 0)

    expect(total).toBe(360)
    expect(over10 / total).toBeLessThanOrEqual(0.2)
  })

  it('прежний фиксированный ландшафтный слот ломал именно моду', () => {
    // Якорь регрессии: слот 396×270 (до #1487) давал квадратной обложке —
    // то есть 80% выдачи — 15.9% поля с каждой стороны; квадратный слот даёт
    // ей 0%. Возврат к ландшафтной константе провалит и этот тест, и владельца.
    const legacy = (slotWidth: number, slotHeight: number, aspectRatio: number) => {
      const { renderedWidth } = resolveCoverSlotGeometry({ slotWidth, slotHeight, aspectRatio })
      return ((slotWidth - (renderedWidth as number)) / 2) / slotWidth
    }
    expect(legacy(396, 270, 1)).toBeGreaterThan(0.1)
    expect(legacy(635, 316, 1)).toBeGreaterThan(0.2)
  })
})

// ---------------------------------------------------------------------------
// #1674: системный гейт контракта слота.
//
// Числовой тест выше защищает ТОЛЬКО те поверхности, которые уже считают слот
// через `CARD_MEDIA_SLOT_RATIO`. Вкладка публичного профиля проехала все
// проверки зелёной, потому что задавала слот пикселями (`imageHeight={180}`)
// при резиновой ширине карточки: контракта пропорций у неё не было вовсе, и
// сравнивать было нечего. Гейт ниже читает исходники и требует, чтобы КАЖДАЯ
// `contain`-карточка объявила пропорции слота (`mediaAspectRatio`), либо
// стояла в замороженном списке известного долга. Новая поверхность в список не
// попадёт и упадёт здесь.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..')
/**
 * Корни сканирования. `screens/` здесь не для полноты: соседний гейт ширины
 * (`scripts/check-image-architecture.js`, #1161) специально смотрит шире
 * `components/` — «следующий вызов легко появится в screens/».
 */
const SCAN_ROOTS = ['components', 'app', 'screens']

const CARD_SOURCE = path.join('components', 'ui', 'UnifiedTravelCard.tsx')
const PROFILE_TAB_SOURCE = path.join(
  'components',
  'screens',
  'profile',
  'PublicProfileTravelsTab.tsx',
)

/**
 * Поверхности `contain`, которые на 2026-09-01 всё ещё задают слот пикселями —
 * своей высотой или дефолтной высотой `imageContainer` у карточки.
 * Список ЗАМОРОЖЕН: он фиксирует существующий долг, а не разрешает новый.
 * Каждая строка — отдельный код-путь со своей геометрией, тикет #1674 их не
 * трогает (scope — вкладка публичного профиля). Следующий шаг по ним —
 * замерить долю поля на прод-обложках так же, как это сделано в #1487.
 */
const FIXED_HEIGHT_SLOT_DEBT = [
  // Явный `mediaFit="contain"` + пиксельная высота слота.
  'components/places/PlaceListCard.tsx',
  'components/quests/TravelsForQuestSection.tsx',
  'components/screens/calendar/calendarScreen.parts.tsx',
  'components/travel/TravelTmlRound.tsx',
  // `mediaFit` приходит пропом, но собственный дефолт обёртки — тоже 'contain'.
  'components/listTravel/TabTravelCard.tsx',
  // `mediaFit` не задан вовсе — работает дефолт `UnifiedTravelCard`, а высоту
  // даёт `imageHeight` (RecentViews) или дефолт `imageContainer` (PublicTripCard).
  'components/travel/RecentViews.tsx',
  'components/trips/PublicTripCard.tsx',
] as const

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  const abs = path.join(REPO_ROOT, dir)
  if (!fs.existsSync(abs)) return acc
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      listSourceFiles(rel, acc)
    } else if (entry.name.endsWith('.tsx')) {
      acc.push(rel)
    }
  }
  return acc
}

/** Упоминание тега в комментарии — не вызов: гейт не должен ловить историю. */
function isCommentedOut(source: string, index: number): boolean {
  const prefix = source.slice(source.lastIndexOf('\n', index - 1) + 1, index)
  return prefix.includes('//') || prefix.trimStart().startsWith('*')
}

/**
 * Возвращает текст пропов каждого открывающего тега `<UnifiedTravelCard` БЕЗ
 * комментариев. Скобки `{}` считаются, чтобы вложенный JSX/объект не оборвал
 * тег раньше времени; кавычки пропускаются целиком.
 *
 * Комментарии обязаны выпадать по двум причинам, и обе — про молчаливый зелёный
 * результат. Во-первых, рядом с этими пропами живёт объяснение прежнего
 * контракта («фиксированные 180 px», «`contain` остаётся»), и гейт ловил бы
 * собственную историю (тот же приём, что `findCodeLineMatching` в
 * `scripts/check-image-architecture.js`). Во-вторых, одиночная кавычка или
 * бэктик в тексте комментария уводит посимвольный сканер в режим строки до
 * конца файла: тег склеивается со следующим, чужой `mediaAspectRatio`
 * засчитывается нарушителю — и гейт перестаёт что-либо проверять.
 */
function extractCardOpenTags(source: string): string[] {
  const tags: string[] = []
  const TAG = '<UnifiedTravelCard'
  let from = 0
  for (;;) {
    const start = source.indexOf(TAG, from)
    if (start === -1) break
    // `<UnifiedTravelCardSomething` — другой компонент, а не эта карточка.
    if (/[A-Za-z0-9_]/.test(source[start + TAG.length] ?? '') || isCommentedOut(source, start)) {
      from = start + TAG.length
      continue
    }
    const props: string[] = [TAG]
    let depth = 0
    let quote: string | null = null
    let i = start + TAG.length
    for (; i < source.length; i += 1) {
      const ch = source[i]
      if (quote) {
        props.push(ch)
        if (ch === '\\') {
          props.push(source[i + 1] ?? '')
          i += 1
        } else if (ch === quote) quote = null
        continue
      }
      if (ch === '/' && source[i + 1] === '/') {
        const eol = source.indexOf('\n', i)
        i = eol === -1 ? source.length : eol
        props.push('\n')
        continue
      }
      if (ch === '/' && source[i + 1] === '*') {
        const end = source.indexOf('*/', i + 2)
        i = end === -1 ? source.length : end + 1
        props.push(' ')
        continue
      }
      props.push(ch)
      if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      else if (ch === '>' && depth === 0) break
    }
    tags.push(props.join(''))
    from = i + 1
  }
  return tags
}

const EXPLICIT_MEDIA_FIT = /mediaFit\s*=\s*(?:["']([a-z]+)["']|\{\s*['"]([a-z]+)['"]\s*\})/

/**
 * `mediaFit` у `UnifiedTravelCard` по умолчанию 'contain', поэтому «пропа нет» —
 * это тоже contain, и именно так выглядит самая вероятная новая поверхность:
 * её автор просто не пишет проп. Мимо гейта уходит только явный не-contain
 * литерал; динамическое значение (`mediaFit={mediaFit}`) остаётся под гейтом —
 * у обёрток-прокси собственный дефолт тоже contain.
 */
const isContainCard = (props: string): boolean => {
  const explicit = EXPLICIT_MEDIA_FIT.exec(props)
  return !explicit || (explicit[1] ?? explicit[2]) === 'contain'
}

const CONTAIN_CARDS = (() => {
  const found: { file: string; props: string }[] = []
  for (const root of SCAN_ROOTS) {
    for (const file of listSourceFiles(root)) {
      const source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
      if (!source.includes('<UnifiedTravelCard')) continue
      for (const props of extractCardOpenTags(source)) {
        if (isContainCard(props)) found.push({ file, props })
      }
    }
  }
  return found
})()

const declaresSlotRatio = (props: string) => /\bmediaAspectRatio\s*=/.test(props)

describe('#1674 гейт: contain-поверхность обязана объявить пропорции слота', () => {
  it('дефолт `mediaFit` у карточки действительно contain', () => {
    // На этом стоит вся ветка «пропа нет — значит contain». Если дефолт когда-то
    // перевернут, гейт обязан упасть здесь, а не тихо перестать ловить.
    const cardSource = fs.readFileSync(path.join(REPO_ROOT, CARD_SOURCE), 'utf8')
    expect(cardSource).toMatch(/mediaFit\s*=\s*'contain'/)
  })

  it('сканер вообще находит contain-карточки', () => {
    // Защита от «зелёного из-за пустой выборки»: если парсер сломается,
    // остальные проверки станут бессмысленно проходить.
    expect(CONTAIN_CARDS.length).toBeGreaterThanOrEqual(5)
    expect(CONTAIN_CARDS.map((c) => c.file)).toContain(
      path.join('components', 'listTravel', 'TravelListItem.tsx'),
    )
  })

  it('вкладка публичного профиля считает слот контрактом, а не пикселями', () => {
    const tabCards = CONTAIN_CARDS.filter((c) => c.file === PROFILE_TAB_SOURCE)
    expect(tabCards).toHaveLength(1)
    expect(tabCards[0].props).toMatch(/mediaAspectRatio=\{CARD_MEDIA_SLOT_RATIO\}/)
    // Пиксельная высота при резиновой ширине — ровно тот дефект, что чинил
    // #1674: слот переставал следовать пропорции и давал полосы.
    expect(tabCards[0].props).not.toMatch(/\bimageHeight\s*=/)
  })

  it('новая contain-поверхность не может проехать без контракта слота', () => {
    const offenders = CONTAIN_CARDS.filter(
      (c) =>
        !declaresSlotRatio(c.props) &&
        !(FIXED_HEIGHT_SLOT_DEBT as readonly string[]).includes(c.file),
    ).map((c) => c.file)
    expect(offenders).toEqual([])
  })

  it('список известного долга не протухает', () => {
    // Поверхность, которая перешла на контракт (или исчезла), обязана уйти из
    // списка — иначе он превращается в вечное разрешение.
    const stale = (FIXED_HEIGHT_SLOT_DEBT as readonly string[]).filter((file) => {
      const cards = CONTAIN_CARDS.filter((c) => c.file === file)
      return cards.length === 0 || cards.every((c) => declaresSlotRatio(c.props))
    })
    expect(stale).toEqual([])
  })
})

describe('#1674 сканер гейта: разбор пропов не врёт на комментариях', () => {
  const findFirst = (source: string) => extractCardOpenTags(source)[0] ?? ''

  it('одиночная кавычка в комментарии не склеивает два тега в один', () => {
    // Без пропуска комментариев апостроф открывал «строку» до конца файла:
    // нарушитель забирал `mediaAspectRatio` следующей карточки и проезжал.
    const source = [
      '<UnifiedTravelCard',
      '  mediaFit="contain"',
      "  // слот don't трогать",
      '  imageHeight={180}',
      '/>',
      '<UnifiedTravelCard mediaFit="contain" mediaAspectRatio={1} />',
    ].join('\n')
    const tags = extractCardOpenTags(source)
    expect(tags).toHaveLength(2)
    expect(declaresSlotRatio(tags[0])).toBe(false)
    expect(declaresSlotRatio(tags[1])).toBe(true)
  })

  it('`>` в комментарии не обрезает тег до объявления пропорций', () => {
    const source = [
      '<UnifiedTravelCard',
      '  mediaFit="contain"',
      '  // ширина > 0 обязательна',
      '  mediaAspectRatio={1}',
      '/>',
    ].join('\n')
    expect(declaresSlotRatio(findFirst(source))).toBe(true)
  })

  it('пропы из комментария не засчитываются как объявленные', () => {
    const source = [
      '<UnifiedTravelCard',
      '  mediaFit="contain"',
      '  /* раньше здесь стоял mediaAspectRatio={1} */',
      '  imageHeight={180}',
      '/>',
    ].join('\n')
    expect(declaresSlotRatio(findFirst(source))).toBe(false)
  })

  it('карточка без `mediaFit` считается contain — это дефолт компонента', () => {
    expect(isContainCard('<UnifiedTravelCard title={t} imageHeight={180} />')).toBe(true)
    expect(isContainCard('<UnifiedTravelCard mediaFit={mediaFit} />')).toBe(true)
    expect(isContainCard('<UnifiedTravelCard mediaFit="cover" />')).toBe(false)
  })

  it('упоминание тега в комментарии не считается вызовом', () => {
    expect(extractCardOpenTags('// как в <UnifiedTravelCard mediaFit="contain" />')).toEqual([])
  })
})
