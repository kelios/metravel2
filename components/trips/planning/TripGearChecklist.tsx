// components/trips/planning/TripGearChecklist.tsx
// Чеклист снаряжения во вкладке «Ещё» планировщика (#1839, макет
// `docs/features/trips-packing-checklist-mock.md`).
//
// Блок приватный: бэк отдаёт список владельцу и участнику с ответом «еду», и
// клиент не запрашивает его для остальных — гость не должен видеть даже пустую
// рамку. Писать может только владелец, поэтому у участника нет ни чипа-действия,
// ни шаблона, ни удаления.
import { memo, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import {
  GEAR_CATEGORY_LABEL,
  GEAR_STATUS_LABEL,
  gearProgress,
  groupGearByCategory,
  nextGearStatus,
} from '@/components/trips/planning/tripGearRules'
import {
  TRIP_GEAR_TITLE_MAX,
  type TripGearCategory,
  type TripGearItem,
  type TripGearStatus,
} from '@/api/plannedTripsGear'
import type { PlannedTrip } from '@/api/plannedTrips'
import { ApiError } from '@/api/client'
import {
  useAddTripGearItem,
  useApplyTripGearTemplate,
  useDeleteTripGearItem,
  useTripGear,
  useUpdateTripGearItem,
} from '@/hooks/useTripGearApi'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

interface Props {
  trip: PlannedTrip
}

// Тач-таргет чипа статуса: макет требует не меньше 44×44 (#1839), и это же
// значение держит `npm run guard:touch-targets`.
const STATUS_CHIP_MIN = 44

const SKELETON_ROWS = [0, 1, 2]

const EMPTY_ITEMS: TripGearItem[] = []

type ChipTone = { background: keyof ThemedColors; text: keyof ThemedColors }

// «Купить» — это долг, «есть» — нейтральное состояние, «взято» — закрытый
// пункт; цвета читаются в том же порядке, что и цикл статуса.
const STATUS_TONE: Record<TripGearStatus, ChipTone> = {
  buy: { background: 'warningSoft', text: 'warningDark' },
  owned: { background: 'infoSoft', text: 'infoDark' },
  packed: { background: 'successSoft', text: 'successDark' },
}

// Отказ доступа и отсутствие эндпоинта повтором не чинятся: кнопка «Повторить»
// над ними только обещала бы то, чего не будет.
const isFinalError = (error: unknown): boolean =>
  error instanceof ApiError && [401, 403, 404, 501].includes(error.status)

const errorMessage = (error: unknown, fallback: string): string => {
  const status = error instanceof ApiError ? error.status : null
  if (status === 401) return i18nT('trips:components.trips.planning.TripGearChecklist.authError')
  if (status === 403) return i18nT('trips:components.trips.planning.TripGearChecklist.forbiddenError')
  if (status === 404 || status === 501) {
    return i18nT('trips:components.trips.planning.TripGearChecklist.unavailableError')
  }
  return fallback
}

interface RowProps {
  item: TripGearItem
  canWrite: boolean
  colors: ThemedColors
  styles: ReturnType<typeof createStyles>
  onToggle: (item: TripGearItem) => void
  onDelete: (item: TripGearItem) => void
}

function GearRow({ item, canWrite, colors, styles, onToggle, onDelete }: RowProps) {
  const tone = STATUS_TONE[item.status]
  const statusLabel = GEAR_STATUS_LABEL[item.status]

  return (
    <View style={styles.row} testID={`trip-gear-item-${item.id}`}>
      <Pressable
        style={[styles.statusChip, { backgroundColor: colors[tone.background] as string }]}
        onPress={canWrite ? () => onToggle(item) : undefined}
        disabled={!canWrite}
        accessibilityRole={canWrite ? 'button' : 'text'}
        accessibilityLabel={
          canWrite
            ? i18nT('trips:components.trips.planning.TripGearChecklist.statusToggle', {
                title: item.title,
                status: statusLabel,
              })
            : `${item.title}: ${statusLabel}`
        }
        testID={`trip-gear-status-${item.id}`}
      >
        <Text style={[styles.statusChipText, { color: colors[tone.text] as string }]} numberOfLines={1}>
          {statusLabel}
        </Text>
      </Pressable>
      <Text style={styles.itemTitle}>{item.title}</Text>
      {canWrite ? (
        <Pressable
          style={styles.deleteButton}
          onPress={() => onDelete(item)}
          accessibilityRole="button"
          accessibilityLabel={i18nT('trips:components.trips.planning.TripGearChecklist.delete', {
            title: item.title,
          })}
          testID={`trip-gear-delete-${item.id}`}
        >
          <Feather name="x" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )
}

function TripGearChecklist({ trip }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const canRead = trip.isOwner || trip.myRsvp === 'going'
  const canWrite = trip.isOwner

  const gearQuery = useTripGear(trip.id, canRead)
  const addItem = useAddTripGearItem()
  const applyTemplate = useApplyTripGearTemplate()
  const updateItem = useUpdateTripGearItem()
  const deleteItem = useDeleteTripGearItem()

  // Категория, в которую сейчас добавляют: форма открыта ровно в одной группе,
  // поэтому новая вещь наследует категорию своего заголовка и владельцу не
  // нужен отдельный выбор категории.
  const [addingCategory, setAddingCategory] = useState<TripGearCategory | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  // `?? []` внутри зависимости давал бы новый массив на каждый рендер и
  // пересчитывал группировку впустую — пустой список запоминается один раз.
  const items = useMemo(() => gearQuery.data ?? EMPTY_ITEMS, [gearQuery.data])
  const groups = useMemo(() => groupGearByCategory(items), [items])
  const progress = useMemo(() => gearProgress(items), [items])

  if (!canRead) return null

  const writeError = addItem.error ?? applyTemplate.error ?? updateItem.error ?? deleteItem.error
  const visibleError = writeError
    ? errorMessage(writeError, i18nT('trips:components.trips.planning.TripGearChecklist.saveError'))
    : gearQuery.isError
      ? errorMessage(gearQuery.error, i18nT('trips:components.trips.planning.TripGearChecklist.loadError'))
      : null
  // Повтор предлагается только там, где он что-то меняет: чтение сорвалось.
  // Отказ записи чинится тем же тапом по чипу, а не отдельной кнопкой.
  const canRetry = !writeError && gearQuery.isError && !isFinalError(gearQuery.error)

  const openAddForm = (category: TripGearCategory) => {
    setAddingCategory(category)
    setDraftTitle('')
  }

  const closeAddForm = () => {
    setAddingCategory(null)
    setDraftTitle('')
  }

  const submitDraft = () => {
    const title = draftTitle.trim()
    if (!title || addingCategory === null) return
    addItem.mutate(
      { tripId: trip.id, title, category: addingCategory },
      { onSuccess: closeAddForm },
    )
  }

  const renderAddControl = (category: TripGearCategory) => {
    if (!canWrite) return null
    if (addingCategory !== category) {
      return (
        <Pressable
          style={styles.addRow}
          onPress={() => openAddForm(category)}
          accessibilityRole="button"
          testID={`trip-gear-add-${category}`}
        >
          <Feather name="plus" size={16} color={colors.primaryText} />
          <Text style={styles.addRowText}>
            {i18nT('trips:components.trips.planning.TripGearChecklist.add')}
          </Text>
        </Pressable>
      )
    }
    return (
      <View style={styles.addForm} testID={`trip-gear-add-form-${category}`}>
        <TextInput
          value={draftTitle}
          onChangeText={(text) => setDraftTitle(text.slice(0, TRIP_GEAR_TITLE_MAX))}
          placeholder={i18nT('trips:components.trips.planning.TripGearChecklist.addTitlePlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.addInput}
          autoFocus
          onSubmitEditing={submitDraft}
          testID="trip-gear-add-input"
        />
        <View style={styles.addFormActions}>
          <Button
            label={i18nT('trips:components.trips.planning.TripGearChecklist.addSubmit')}
            size="md"
            onPress={submitDraft}
            disabled={draftTitle.trim().length === 0}
            loading={addItem.isPending}
            testID="trip-gear-add-submit"
          />
          <Button
            label={i18nT('trips:components.trips.planning.TripGearChecklist.addCancel')}
            variant="outline"
            size="md"
            onPress={closeAddForm}
            testID="trip-gear-add-cancel"
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrap} testID="trip-gear-checklist">
      <View style={styles.headRow}>
        <Feather name="check-square" size={18} color={colors.primaryDark} />
        <Text style={styles.heading}>
          {i18nT('trips:components.trips.planning.TripGearChecklist.heading')}
        </Text>
        {items.length > 0 ? (
          <Text style={styles.progress} testID="trip-gear-progress">
            {progress.complete
              ? i18nT('trips:components.trips.planning.TripGearChecklist.allPacked')
              : i18nT('trips:components.trips.planning.TripGearChecklist.progress', {
                  packed: progress.packed,
                  total: progress.total,
                })}
          </Text>
        ) : null}
      </View>

      {gearQuery.isLoading ? (
        <View style={styles.skeletonBlock} accessibilityRole="progressbar" testID="trip-gear-loading">
          {SKELETON_ROWS.map((row) => (
            <View key={row} style={styles.skeletonRow} />
          ))}
          <ActivityIndicator
            size="small"
            color={colors.primaryDark}
            accessibilityLabel={i18nT('trips:components.trips.planning.TripGearChecklist.loading')}
          />
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.category} style={styles.group} testID={`trip-gear-group-${group.category}`}>
          <Text style={styles.groupTitle}>{GEAR_CATEGORY_LABEL[group.category]}</Text>
          {group.items.map((item) => (
            <GearRow
              key={item.id}
              item={item}
              canWrite={canWrite}
              colors={colors}
              styles={styles}
              onToggle={(target) =>
                updateItem.mutate({
                  tripId: trip.id,
                  itemId: target.id,
                  status: nextGearStatus(target.status),
                })
              }
              onDelete={(target) => deleteItem.mutate({ tripId: trip.id, itemId: target.id })}
            />
          ))}
          {renderAddControl(group.category)}
        </View>
      ))}

      {!gearQuery.isLoading && items.length === 0 ? (
        <View style={styles.empty} testID="trip-gear-empty">
          <Text style={styles.emptyText}>
            {i18nT('trips:components.trips.planning.TripGearChecklist.empty')}
          </Text>
          {canWrite ? (
            <View style={styles.emptyActions}>
              <Button
                label={i18nT('trips:components.trips.planning.TripGearChecklist.template')}
                size="md"
                loading={applyTemplate.isPending}
                onPress={() => applyTemplate.mutate({ tripId: trip.id })}
                testID="trip-gear-template"
              />
              {addingCategory === null ? (
                <Button
                  label={i18nT('trips:components.trips.planning.TripGearChecklist.add')}
                  variant="outline"
                  size="md"
                  onPress={() => openAddForm('other')}
                  testID="trip-gear-add-other"
                />
              ) : null}
            </View>
          ) : null}
          {canWrite && addingCategory !== null ? renderAddControl(addingCategory) : null}
        </View>
      ) : null}

      {canWrite && items.length > 0 ? (
        <Button
          label={i18nT('trips:components.trips.planning.TripGearChecklist.template')}
          variant="outline"
          size="md"
          loading={applyTemplate.isPending}
          onPress={() => applyTemplate.mutate({ tripId: trip.id })}
          testID="trip-gear-template"
        />
      ) : null}

      {applyTemplate.isSuccess && applyTemplate.data?.length === 0 ? (
        <Text style={styles.hint} testID="trip-gear-template-nothing-new">
          {i18nT('trips:components.trips.planning.TripGearChecklist.templateNothingNew')}
        </Text>
      ) : null}

      {visibleError ? (
        <View style={styles.errorState} accessibilityRole="alert" testID="trip-gear-error">
          <View style={styles.errorTextRow}>
            <Feather name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{visibleError}</Text>
          </View>
          {canRetry ? (
            <Button
              label={i18nT('trips:components.trips.planning.TripGearChecklist.retry')}
              variant="outline"
              size="md"
              loading={gearQuery.isFetching}
              onPress={() => {
                void gearQuery.refetch()
              }}
              icon={<Feather name="refresh-cw" size={16} color={colors.primaryDark} />}
              testID="trip-gear-retry"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    progress: { flex: 1, minWidth: 0, fontSize: 13, color: colors.textMuted, textAlign: 'right' },
    group: { gap: 6 },
    groupTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 12,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
    },
    statusChip: {
      minWidth: STATUS_CHIP_MIN,
      minHeight: STATUS_CHIP_MIN,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingHorizontal: 10,
    },
    statusChipText: { fontSize: 12, fontWeight: '700' },
    itemTitle: { flex: 1, minWidth: 0, fontSize: 15, color: colors.text, paddingVertical: 10 },
    deleteButton: {
      width: STATUS_CHIP_MIN,
      height: STATUS_CHIP_MIN,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: STATUS_CHIP_MIN,
      paddingHorizontal: 10,
    },
    addRowText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
    addForm: { gap: 8 },
    addInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      minHeight: STATUS_CHIP_MIN,
      color: colors.text,
      backgroundColor: colors.background,
      fontSize: 15,
    },
    addFormActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    empty: { gap: 10 },
    emptyText: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
    emptyActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    hint: { fontSize: 13, color: colors.textMuted },
    skeletonBlock: { gap: 8 },
    skeletonRow: {
      height: STATUS_CHIP_MIN + 2,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    errorState: { gap: 8, borderRadius: 10, padding: 10, backgroundColor: colors.dangerLight },
    errorTextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    errorText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, color: colors.text },
  })

export default memo(TripGearChecklist)
