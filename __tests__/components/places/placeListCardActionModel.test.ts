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
// карте», «Прочитать», «Мои точки», «Навигация» + стрелку Telegram у заголовка.
describe('placeListCardActionModel actionBudget', () => {
  const onMap: ActionChip = { key: 'open-map', label: 'На карте', icon: 'map-pin', onPress: noop }
  const article: ActionChip = { key: 'article', label: 'Прочитать', icon: 'book-open', onPress: noop }
  const route: ActionChip = { key: 'route', label: 'Маршрут', icon: 'corner-up-right', onPress: noop }
  const placesCard = {
    actionBudget: true,
    addButtonPlacement: 'button',
    inlineActions: [onMap, article],
    mapActions: [nav],
    onAddPoint: noop,
    onCopyCoord: noop,
    onShare: noop,
  }

  it('/places: main + secondary + «Сохранить» in the row, the rest in «⋯»', () => {
    const model = build(placesCard)
    expect(model.visibleInlineActions.map((a) => a.key)).toEqual(['open-map', 'article'])
    expect(model.showSaveTile).toBe(true)
    expect(model.showCopyChip).toBe(false)
    expect(model.showShareChip).toBe(false)
    expect(model.showTitleShare).toBe(false)
    expect(model.showRowQuickActions).toBe(false)
    expect(model.overflowActions.map((a) => a.key)).toEqual(['google', 'copy-coord', 'share'])
  })

  it('never shows more than three labelled row actions besides «⋯»', () => {
    const model = build({ ...placesCard, quickActions: [route] })
    const labelled =
      model.visibleInlineActions.length + (model.showSaveTile ? 1 : 0) +
      (model.showRowQuickActions ? 1 : 0) + (model.showCopyChip ? 1 : 0) + (model.showShareChip ? 1 : 0)
    expect(labelled).toBeLessThanOrEqual(3)
    expect(model.overflowActions.map((a) => a.key)).toEqual(['route', 'google', 'copy-coord', 'share'])
  })

  it('without the budget the existing cards keep their row (travel points, «Мои точки»)', () => {
    const model = build({ ...placesCard, actionBudget: false })
    expect(model.showCopyChip).toBe(true)
    expect(model.showTitleShare).toBe(true)
    expect(model.overflowActions.map((a) => a.key)).toEqual(['google'])
  })
})
