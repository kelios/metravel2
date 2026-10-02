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
