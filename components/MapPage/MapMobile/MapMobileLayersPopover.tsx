/**
 * MapMobileLayersPopover — compact layers/overlays panel under the ⧉ Слои icon.
 *
 * Reuses the existing FiltersPanelMapSettings body (base-layer chips + overlay
 * toggles, sourced from `config/mapWebLayers.ts`) — no duplicated layer logic.
 * It is driven by the same controlled overlay state the filters sheet uses
 * (`overlayOptions` / `enabledOverlays` / `onOverlayToggle` / `mapUiApi`).
 *
 * Tapping a toggle switches the layer in place; the popover stays open so the
 * user can flip several layers. Closing is via tap-outside (the popover backdrop)
 * or the close icon.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useDockReservePx } from '@/components/layout/bottomChromeInset'
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings'
import getFiltersPanelStyles from '@/components/MapPage/filtersPanelStyles'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'

import { MapMobilePopover } from './MapMobilePopover'
import { translate as i18nT } from '@/i18n'


interface OverlayOption {
  id: string
  title: string
  category?: string
  subtitle?: string
  badge?: string
}

interface MapMobileLayersPopoverProps {
  colors: ThemedColors
  top: number
  /** Card right-edge offset. Desktop floating icon anchors the card to itself. */
  right?: number
  /** Card min width. Mobile toolbar passes a wider value so labels do not collapse. */
  minWidth?: number
  /** Card max width. Desktop uses a slightly wider card than mobile. */
  maxWidth?: number
  /**
   * Высота прокручиваемого списка слоёв. Дефолт рассчитан на карту во весь
   * экран; встроенная карта конструктора маршрута (320px) передаёт меньше,
   * иначе карточка не влезает в её `overflow: hidden`.
   */
  scrollMaxHeight?: number
  /** Card height cap down to the dock (desktop branch, #2243-III); the body scrolls. */
  maxHeight?: number
  /**
   * Показывать выбор базовой подложки. `false` — у карты своя подложка, которой
   * `MapUiApi.setBaseLayer` не управляет (карта конструктора маршрута).
   */
  showBaseLayer?: boolean
  /**
   * Показывать ряд действий карты («Показать всё на карте»). `false` — поповер
   * работает чистым списком слоёв (карта конструктора маршрута).
   */
  showMapControls?: boolean
  mapUiApi?: MapUiApi | null
  overlayOptions?: ReadonlyArray<OverlayOption>
  enabledOverlays?: Record<string, boolean>
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  /**
   * #2251 — phone layout: the entry to the map tour lives in this card, which
   * the toolbar names «Слои и настройки карты». The desktop branch has its own
   * «Подсказки» button on the map and does not pass it.
   */
  onShowHelp?: () => void
  onRequestClose: () => void
}

const MapMobileLayersPopoverInner: React.FC<MapMobileLayersPopoverProps> = ({
  colors,
  top,
  right,
  minWidth,
  maxWidth,
  scrollMaxHeight,
  maxHeight,
  showBaseLayer,
  showMapControls,
  mapUiApi,
  overlayOptions,
  enabledOverlays,
  onOverlayToggle,
  onResetOverlays,
  onShowHelp,
  onRequestClose,
}) => {
  const { width } = useWindowDimensions()
  const dockPx = useDockReservePx()
  const panelStyles = useMemo(
    () => getFiltersPanelStyles(colors, true, width, dockPx),
    [colors, dockPx, width],
  )

  return (
    <MapMobilePopover
      colors={colors}
      top={top}
      right={right}
      minWidth={minWidth}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      onRequestClose={onRequestClose}
      testID="map-mobile-layers-popover"
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {i18nT('map:components.MapPage.MapMobile.MapMobileLayersPopover.sloi_karty_61711812')}</Text>
        <Pressable
          testID="map-mobile-layers-popover-close"
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileLayersPopover.zakryt_ceb4ed2d')}
          style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
        >
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={[
          styles.scroll,
          scrollMaxHeight ? { maxHeight: scrollMaxHeight } : null,
        ]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <FiltersPanelMapSettings
          colors={colors}
          styles={panelStyles}
          isMobile
          mode="radius"
          mapUiApi={mapUiApi}
          showBaseLayer={showBaseLayer}
          showMapControls={showMapControls}
          overlayOptions={overlayOptions ? [...overlayOptions] : undefined}
          enabledOverlays={enabledOverlays}
          onOverlayToggle={onOverlayToggle}
          onResetOverlays={onResetOverlays}
          totalPoints={0}
          hasFilters={false}
          canBuildRoute={false}
          hideReset
          withContainer={false}
        />
      </ScrollView>

      {onShowHelp ? (
        <Pressable
          testID="map-mobile-help-button"
          onPress={onShowHelp}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.helpRow,
            { borderTopColor: colors.borderLight },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Feather name="help-circle" size={18} color={colors.text} />
          <Text style={[styles.helpText, { color: colors.text }]} numberOfLines={2}>
            {i18nT('map:components.MapPage.MapPanelHeader.pokazat_podskazki_po_karte_5d9bc7dd')}
          </Text>
        </Pressable>
      ) : null}
    </MapMobilePopover>
  )
}

/** Совпадает с `paddingVertical`/`paddingHorizontal` карточки `MapMobilePopover`. */
const CARD_PADDING = 8
const CLOSE_TOUCH_TARGET_SIZE = 44

const styles = StyleSheet.create({
  // Крестик — собственная рамка 44×44 вместо иконки 18 с hitSlop (#2236): над
  // native-картой кольцо hitSlop на Android отдаёт касание кнопке в JS, а
  // нативное — тому, что под точкой. Чтобы рамка не раздувала карточку, шапка
  // заходит в верхний и правый padding карточки (8): её верх и правый край —
  // внутренняя граница карточки, рамка крестика целиком внутри карточки, а
  // заголовок и иконка остаются на прежней высоте (центр 22 от верха).
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -CARD_PADDING,
    marginRight: -CARD_PADDING,
    paddingLeft: 8,
  },
  closeButton: {
    width: CLOSE_TOUCH_TARGET_SIZE,
    height: CLOSE_TOUCH_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 420,
    // Shrinks under the card's `maxHeight` so the header stays and the body scrolls.
    flexShrink: 1,
  },
  // A row with a visible label, its own ≥44 box inside the card (no hitSlop
  // over the map, #2236); the label may wrap to two lines in long locales.
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    minHeight: CLOSE_TOUCH_TARGET_SIZE,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
})

export const MapMobileLayersPopover = React.memo(MapMobileLayersPopoverInner)
