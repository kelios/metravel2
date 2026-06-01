import { lazy, Suspense } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { Travel } from '@/types/types'
import type ListTravelExportControls from '../ListTravelExportControls'

const ListTravelExportControlsLazy = lazy(() => import('../ListTravelExportControls'))

type TopContentStyles = {
  fallbackNotice: any
  fallbackNoticeTitle: any
  fallbackNoticeText: any
  fallbackNoticeAction: any
  fallbackNoticeActionText: any
}

type ExportControlsProps = React.ComponentProps<typeof ListTravelExportControls>

type ListTravelTopContentProps = {
  isExport: boolean
  showFallbackNotice: boolean
  onClearAll: () => void
  styles: TopContentStyles
  isMobile: boolean
  travels: Travel[]
  selected: ExportControlsProps['selected']
  ownerName: ExportControlsProps['ownerName']
  toggleSelectAll: ExportControlsProps['toggleSelectAll']
  clearSelection: ExportControlsProps['clearSelection']
  moveSelected: ExportControlsProps['moveSelected']
  moveSelectedTo: ExportControlsProps['moveSelectedTo']
  hasSelection: ExportControlsProps['hasSelection']
  selectionCount: ExportControlsProps['selectionCount']
  baseSettings: ExportControlsProps['baseSettings']
  lastSettings: ExportControlsProps['lastSettings']
  settingsSummary: ExportControlsProps['settingsSummary']
  setLastSettings: ExportControlsProps['setLastSettings']
}

export default function ListTravelTopContent({
  isExport,
  showFallbackNotice,
  onClearAll,
  styles,
  isMobile,
  travels,
  selected,
  ownerName,
  toggleSelectAll,
  clearSelection,
  moveSelected,
  moveSelectedTo,
  hasSelection,
  selectionCount,
  baseSettings,
  lastSettings,
  settingsSummary,
  setLastSettings,
}: ListTravelTopContentProps) {
  const exportControls = isExport ? (
    <Suspense fallback={null}>
      <ListTravelExportControlsLazy
        isMobile={isMobile}
        travels={travels}
        selected={selected}
        ownerName={ownerName}
        toggleSelectAll={toggleSelectAll}
        clearSelection={clearSelection}
        moveSelected={moveSelected}
        moveSelectedTo={moveSelectedTo}
        hasSelection={hasSelection}
        selectionCount={selectionCount}
        baseSettings={baseSettings}
        lastSettings={lastSettings}
        settingsSummary={settingsSummary}
        setLastSettings={setLastSettings}
      />
    </Suspense>
  ) : null

  const fallbackNotice = showFallbackNotice ? (
    <View style={styles.fallbackNotice} testID="travel-results-fallback-notice">
      <Text style={styles.fallbackNoticeTitle}>Похожие маршруты</Text>
      <Text style={styles.fallbackNoticeText}>
        По вашему запросу точных совпадений не нашлось. Подобрали похожие маршруты — возможно, что-то из них вам подойдёт.
      </Text>
      <Pressable
        onPress={onClearAll}
        style={styles.fallbackNoticeAction}
        accessibilityRole="button"
        accessibilityLabel="Сбросить условия и показать все маршруты"
      >
        <Text style={styles.fallbackNoticeActionText}>Сбросить условия</Text>
      </Pressable>
    </View>
  ) : null

  if (!fallbackNotice && !exportControls) return null

  return (
    <>
      {fallbackNotice}
      {exportControls}
    </>
  )
}
