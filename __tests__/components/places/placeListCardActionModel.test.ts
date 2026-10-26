import { buildPlaceListCardActionModel } from '@/components/places/placeListCardActionModel'
import type { ActionChip } from '@/components/places/PlaceListCard.types'

const noop = () => undefined
const edit: ActionChip = { key: 'edit', label: 'Изменить', icon: 'edit-2', onPress: noop }
const del: ActionChip = { key: 'delete', label: 'Удалить', icon: 'trash-2', onPress: noop, destructive: true }
const nav: ActionChip = { key: 'google', label: 'Google', icon: 'map', onPress: noop }

const build = (over: Record<string, unknown>) =>
  buildPlaceListCardActionModel({
    addButtonPlacement: 'row',
    addLabel: 'Сохранить',
    colors: {} as never,
    hasCoord: true,
    inlineActions: [],
    isAdding: false,
    isCompactActionCard: true,
    isSaved: false,
    mapActions: [],
    menuActions: [],
    popupAligned: true,
    quickActions: [],
    showActionRow: true,
    showAddButton: false,
    showTitleInContent: true,
    ...over,
  } as never)

// #2101: правка/удаление объекта попадают в «⋯» на любой раскладке карточки.
describe('placeListCardActionModel menuActions', () => {
  it.each([true, false])('compact=%s: «⋯» содержит правку и удаление, удаление последним', (compact) => {
    const model = build({ isCompactActionCard: compact, menuActions: [edit, del] })
    expect(model.overflowActions.map((a) => a.key)).toEqual(['edit', 'delete'])
    expect(model.overflowActions[model.overflowActions.length - 1].destructive).toBe(true)
    expect(model.hasActionRow).toBe(true)
  })

  it('compact: пункты навигации идут перед правкой и удалением', () => {
    const model = build({ mapActions: [nav], menuActions: [edit, del] })
    expect(model.overflowActions.map((a) => a.key)).toEqual(['google', 'edit', 'delete'])
  })

  it('без menuActions «⋯» не появляется у non-compact карточки', () => {
    expect(build({ isCompactActionCard: false }).overflowActions).toEqual([])
  })
})

// #2778 (PLACE-CARD-ACTION-OVERLOAD): на `/places` ряд набирал «Коорд.», «На
// карте», «Прочитать», «Мои точки», «Навигация» + стрелку Telegram у заголовка;
// приёмка: даже четыре плитки на 320 резали подписи — бюджет ряда три плитки ВСЕГО.
describe('placeListCardActionModel actionBudget', () => {
  const onMap: ActionChip = { key: 'open-map', label: 'На карте', icon: 'map-pin', onPress: noop }
  const article: ActionChip = { key: 'article', label: 'Прочитать', icon: 'book-open', onPress: noop }
  const route: ActionChip = { key: 'route', label: 'Маршрут', icon: 'corner-up-right', onPress: noop }
  const open: ActionChip = { key: 'open', label: 'Открыть', icon: 'book-open', onPress: noop }
  const placesCard = {
    actionBudget: true,
    addButtonPlacement: 'button',
    inlineActions: [article, onMap],
    mapActions: [nav],
    onAddPoint: noop,
    onCopyCoord: noop,
    onShare: noop,
  }
  const rowTiles = (model: ReturnType<typeof build>) =>
    model.visibleInlineActions.length + (model.showSaveTile ? 1 : 0) +
    (model.showRowQuickActions ? 1 : 0) + (model.showCopyChip ? 1 : 0) + (model.showShareChip ? 1 : 0) +
    (model.overflowActions.length > 0 ? 1 : 0)

  it('/places: «Прочитать», «Сохранить», «Навигация» — the rest lives in the sheet', () => {
    const model = build(placesCard)
    expect(model.visibleInlineActions.map((a) => a.key)).toEqual(['article'])
    expect(model.showSaveTile).toBe(true)
    expect(model.showCopyChip).toBe(false)
    expect(model.showShareChip).toBe(false)
    expect(model.showTitleShare).toBe(false)
    expect(model.showRowQuickActions).toBe(false)
    expect(model.overflowActions.map((a) => a.key)).toEqual(['open-map', 'google', 'copy-coord', 'share'])
    expect(rowTiles(model)).toBe(3)
  })

  it.each([
    ['/places', placesCard],
    ['/places without an article', { ...placesCard, inlineActions: [onMap] }],
    ['map list on native (route quick action)', { ...placesCard, inlineActions: [open], quickActions: [route] }],
    ['no save, nothing for the sheet', { actionBudget: true, inlineActions: [article, onMap, open], hasCoord: false }],
  ])('%s: never more than three tiles in the row, sheet entry included', (_label, over) => {
    expect(rowTiles(build(over))).toBeLessThanOrEqual(3)
  })

  it('map list keeps «Открыть», «Сохранить», «Навигация»', () => {
    const model = build({ ...placesCard, inlineActions: [open], quickActions: [route] })
    expect(model.visibleInlineActions.map((a) => a.key)).toEqual(['open'])
    expect(model.overflowActions.map((a) => a.key)).toEqual(['route', 'google', 'copy-coord', 'share'])
  })

  it('without the budget the existing cards keep their row (travel points, «Мои точки»)', () => {
    const model = build({ ...placesCard, actionBudget: false })
    expect(model.showCopyChip).toBe(true)
    expect(model.showTitleShare).toBe(true)
    expect(model.overflowActions.map((a) => a.key)).toEqual(['google'])
  })
})

// Вмещаемость подписей трёх плиток на 320 во всех локалях. Геометрия — из
// PlaceListCard (compact + popupAligned): карточка `/places` = 320 − 2·spacing.lg,
// поля контента 12, зазор ряда 6, поля плитки 4, подпись 10px/600. Ширина
// символа взята с запасом 6px (0.6em; кириллица/латиница semibold ≈ 5.3–5.8).
describe('/places row labels fit 320 in every locale (#2778)', () => {
  const { DESIGN_TOKENS } = require('@/constants/designSystem')
  const { resources } = require('@/i18n/resources')
  const CARD = 320 - 2 * DESIGN_TOKENS.spacing.lg
  const LABEL_AREA = (CARD - 2 * 12 - 2 * 6) / 3 - 2 * 4
  const CHAR_PX = 6
  const KEYS = [
    'screens.tabs.PlacesScreen_parts.statya_28264f10',
    'components.MapPage.AddressListItem.AddressListItemCard.sohranit_06fb5b11',
    'components.places.PlaceListCard.sohraneno_d848c817',
    'components.places.PlaceListCard.navigatsiya_fa115805',
    'components.places.PlaceListCard.esche_16276b19',
  ]

  it.each(Object.keys(resources))('%s', (locale) => {
    const bundle = resources[locale].map as Record<string, string>
    for (const key of KEYS) {
      const label = bundle[key]
      expect(typeof label).toBe('string')
      expect({ key, width: [...label].length * CHAR_PX <= LABEL_AREA }).toEqual({ key, width: true })
    }
  })
})
