import { Pressable, Text, View } from 'react-native'
import type { Travel } from '@/types/types'
import ListTravelExportControls from '../ListTravelExportControls'
import type { createListTravelBaseStyles } from '../ListTravelBase.styles'
import { translate as i18nT } from '@/i18n'


type ListTravelBaseStyles = ReturnType<typeof createListTravelBaseStyles>

type TopContentStyles = Pick<
  ListTravelBaseStyles,
  | 'fallbackNotice'
  | 'fallbackNoticeTitle'
  | 'fallbackNoticeText'
  | 'fallbackNoticeAction'
  | 'fallbackNoticeActionText'
>

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
    <ListTravelExportControls
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
  ) : null

  const fallbackNotice = showFallbackNotice ? (
    <View style={styles.fallbackNotice} testID="travel-results-fallback-notice">
      <Text style={styles.fallbackNoticeTitle}>{i18nT('travel:components.listTravel.parts.ListTravelTopContent.pohozhie_marshruty_f6f509b4')}</Text>
      <Text style={styles.fallbackNoticeText}>
        {i18nT('travel:components.listTravel.parts.ListTravelTopContent.po_vashemu_zaprosu_tochnyh_sovpadeniy_ne_nas_4d890260')}</Text>
      <Pressable
        onPress={onClearAll}
        style={styles.fallbackNoticeAction}
        accessibilityRole="button"
        accessibilityLabel={i18nT('travel:components.listTravel.parts.ListTravelTopContent.sbrosit_usloviya_i_pokazat_vse_marshruty_db3cc1e4')}
      >
        <Text style={styles.fallbackNoticeActionText}>{i18nT('travel:components.listTravel.parts.ListTravelTopContent.sbrosit_usloviya_8558df42')}</Text>
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
