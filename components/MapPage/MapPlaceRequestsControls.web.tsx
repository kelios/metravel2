import Feather from '@expo/vector-icons/Feather'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native'

import PlaceRequestCard from '@/components/places/PlaceRequestCard'
import WeatherLegend from '@/components/MapPage/WeatherLegend'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { Body } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { MapPlaceRequestsState } from '@/hooks/map/useMapPlaceRequests'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { buildPlaceRequestsHref } from '@/utils/placeRequestCreateIntent'
import { useRouter, type Href } from 'expo-router'

export function MapPlaceRequestsControls({ state, isMobile, weatherOverlays }: {
  state: MapPlaceRequestsState
  isMobile: boolean
  weatherOverlays?: Record<string, boolean> | null
}) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const router = useRouter()
  const legendRef = useRef<ViewInstance>(null)
  const { layer, legendHost, panel, detailData } = state
  if (!layer) return null

  const title = t('places:contributions.map.layer')
  const isList = panel === 'list'
  const isLoading = isList ? state.listLoading : state.detailLoading
  const hasError = isList ? state.listError : state.detailError
  const retry = isList ? state.retryList : state.retryDetail
  function closePanel() {
    state.close()
    if (typeof document === 'undefined') return
    // The modal restores its trigger if it still exists. A retired pin can
    // have disappeared while the panel was open.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) legendRef.current?.focus()
    })
  }

  const content = (
    <View style={styles.content}>
      {isLoading ? <Body muted>{t('places:contributions.loading')}</Body> : hasError ? (
        <>
          <Body>{t('places:contributions.loadError')}</Body>
          <Button label={t('places:contributions.retry')} onPress={() => { void retry() }} />
        </>
      ) : isList ? (
        <>
          <Body muted>{t('places:contributions.map.legend')}</Body>
          {layer.markers.length ? layer.markers.map(({ id, name }) => (
            <Button key={id} label={name} variant="secondary" onPress={() => state.openRequest(id)} fullWidth />
          )) : <Body>{t('places:contributions.empty')}</Body>}
        </>
      ) : detailData ? (
        <PlaceRequestCard request={detailData} regionLabel={detailData.address} source="map" />
      ) : (
        <Body>{t('places:contributions.unavailable')}</Body>
      )}
      {isList ? (
        <Button label={t('places:contributions.backToRequests')} variant="ghost" onPress={() => {
          state.close()
          router.push(buildPlaceRequestsHref('map') as Href)
        }} />
      ) : (
        <Button label={t('places:contributions.map.list')} variant="ghost" onPress={state.openList} />
      )}
    </View>
  )

  return (
    <>
      {legendHost && createPortal(
        <View style={styles.legend}>
          {weatherOverlays && <WeatherLegend enabledOverlays={weatherOverlays} inControlStack />}
          <Button
            ref={legendRef}
            label={title}
            accessibilityHint={t('places:contributions.map.list')}
            icon={<Feather name="heart" size={16} color={colors.dangerDark} />}
            variant="secondary"
            style={styles.legendButton}
            onPress={state.openList}
            testID="map-place-requests-legend"
          />
        </View>,
        legendHost,
      )}
      {panel ? (
        <BottomSheet title={title} visible onClose={closePanel} placement={isMobile ? 'bottom' : 'center'}>
          {isMobile ? (
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">{content}</ScrollView>
          ) : content}
        </BottomSheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  legend: { maxWidth: 240, alignItems: 'flex-end', gap: DESIGN_TOKENS.spacing.sm },
  legendButton: { pointerEvents: 'auto' },
  scroll: { flexShrink: 1 },
  content: {
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
})
