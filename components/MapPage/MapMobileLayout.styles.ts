import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

const MOBILE_WEB_BOTTOM_CHROME_GAP = 28
const CONTROL_RADIUS = 12

type MapMobileLayoutStyleOptions = {
  isNarrow: boolean
  compactSheetActions: boolean
  stackSheetToolbar: boolean
  isSheetPreview: boolean
}

export const getMapMobileLayoutStyles = (
  colors: ThemedColors,
  options: MapMobileLayoutStyleOptions,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web'
        ? ({
            height: '100%',
            // iOS Safari: `100vh` is the LARGE viewport (taller than the visible
            // area under the dynamic toolbar), which pushes the bottom-anchored
            // search pill + Leaflet attribution up into the middle. Clamp to the
            // JS-measured visible viewport (--metravel-map-vh, see
            // hooks/useMapViewportHeightVar.ts) so bottom controls stay at the
            // bottom AND in-app WebViews (where `dvh` collapses to 0) don't pin
            // the layout to zero height. `100svh` is the pre-measurement
            // fallback (stable small viewport, reliable in WebViews).
            maxHeight: 'var(--metravel-map-vh, 100svh)',
            overflow: 'hidden',
          } as any)
        : null),
    },
    // #217 — overlay layout sits on top of the shared (stable) map host. The
    // background is transparent so the map shows through, and there is no
    // overflow clipping that would hide the bottom sheet.
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            overflow: 'visible',
          } as any)
        : null),
    },
    mapContainer: {
      flex: 1,
      minHeight: 240,
      ...(Platform.OS === 'web'
        ? ({
            overflow: 'visible',
            position: 'relative',
            backgroundColor: 'transparent',
          } as any)
        : null),
    },
    sheetRoot: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      ...Platform.select({
        web: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        } as any,
      }),
    },
    sheetRootPreview: {
      backgroundColor: colors.surfaceAlpha40,
    },
    sheetToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isNarrow ? 6 : 8,
      minHeight: options.isNarrow ? 38 : 42,
      paddingVertical: options.isNarrow ? 8 : 10,
      paddingLeft: options.isNarrow ? 10 : 12,
      paddingRight: options.isNarrow ? 10 : 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            // Это мобильный лейаут — live backdrop-filter поверх скролла карты
            // убивает GPU. Статичный «фрост» (colors.surfaceMuted), как в
            // Map/MapControls.tsx и PlacePopupCard/styles.ts (см. CLAUDE.md).
            backgroundColor: colors.surfaceMuted,
            boxShadow: '0 3px 10px rgba(15,23,42,0.05)',
            position: 'relative',
            zIndex: 20,
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }),
    },
    sheetToolbarPreview: {
      minHeight: options.isNarrow ? 36 : 40,
      paddingVertical: options.isNarrow ? 3 : 5,
      paddingLeft: options.isNarrow ? 8 : 12,
      paddingRight: options.isNarrow ? 8 : 12,
      backgroundColor: colors.backgroundSecondary,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
          } as any)
        : null),
    },
    sheetToolbarActions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      flexShrink: 0,
      justifyContent: 'flex-end' as const,
      ...(Platform.OS === 'web'
        ? ({
            position: 'relative',
            zIndex: 21,
          } as any)
        : null),
    },
    sheetToolbarActionsPreview: {
      gap: 6,
    },
    sheetToolbarActionsStacked: {
      alignSelf: 'stretch',
      justifyContent: 'flex-end' as const,
    },
    sheetToolbarActionsFloatingClose: {
      position: 'relative',
    },
    sheetToolbarCloseOnly: {},
    sheetCloseButton: {
      // Тач-таргет >=44px (a11y), визуальный размер сохраняем компактным.
      width: 44,
      height: 44,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexShrink: 0,
      marginHorizontal: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }),
    },
    sheetToolbarCloseButton: {
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 8px 20px rgba(15,23,42,0.10)',
            position: 'relative',
            zIndex: 22,
          } as any)
        : {
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
          }),
    },
    sheetToolbarCloseButtonFloating: {},
    sheetCloseIcon: {
      ...(Platform.OS === 'web'
        ? ({
            pointerEvents: 'none',
          } as any)
        : null),
    },
    sheetShowResultsButton: {
      flexDirection: 'row' as const,
      height: options.isNarrow ? 34 : 38,
      minWidth: options.isNarrow ? 34 : 38,
      paddingHorizontal: options.isNarrow ? 8 : 10,
      gap: 4,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      flexShrink: 0,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: 'none', cursor: 'pointer' } as any)
        : null),
    },
    sheetShowResultsButtonCompact: {
      height: 36,
      minWidth: 36,
      paddingHorizontal: 8,
    },
    sheetPrimaryActionText: {
      fontSize: options.isNarrow ? 12 : 13,
      fontWeight: '800' as const,
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
    sheetToolbarButtonStacked: {
      minWidth: 0,
    },
    sheetIconButtonCompact: {
      width: 36,
      height: 36,
      borderRadius: 11,
    },
    sheetIconButtonStacked: {
      minWidth: 0,
      borderRadius: 14,
    },
    sheetResultsBadge: {
      fontSize: options.compactSheetActions ? 10 : 11,
      fontWeight: '700' as const,
      lineHeight: 14,
      backgroundColor: 'rgba(255,255,255,0.20)',
      borderRadius: 999,
      paddingHorizontal: options.compactSheetActions ? 5 : 6,
      paddingVertical: 1,
      overflow: 'hidden' as const,
    },
    sheetToolbarLeft: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      gap: 4,
    },
    sheetToolbarLeftStacked: {
      alignSelf: 'stretch',
    },
    sheetToolbarLeftWithFloatingClose: {},
    sheetToolbarSummary: {
      marginTop: 2,
      paddingHorizontal: 2,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '600' as const,
      color: colors.textMuted,
      letterSpacing: 0,
    },
    sheetToolbarSummaryPreview: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 14,
    },
    sheetToolbarRight: {
      flexShrink: 0,
    },
    sheetToolbarInline: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sheetToolbarStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8,
    },
    sheetToolbarFullWidth: {},
    sheetIconButton: {
      width: 36,
      height: 36,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceAlpha40,
      flexShrink: 0,
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...Platform.select({
        web: {
          alignSelf: 'flex-end',
        },
      }),
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.12s ease',
          } as any)
        : null),
    },
    sheetResetButton: {
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceAlpha40,
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...Platform.select({
        web: {
          alignSelf: 'flex-end',
          boxShadow: 'none',
          cursor: 'pointer',
        } as any,
      }),
    },
    sheetBody: {
      flex: 1,
      minHeight: 0,
      ...Platform.select({
        web: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          paddingHorizontal: options.isNarrow ? 2 : 6,
          position: 'relative',
          zIndex: 0,
        },
      }),
    },
    sheetFallback: {
      flex: 1,
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: options.isNarrow ? 18 : 24,
      paddingVertical: options.isNarrow ? 18 : 24,
    },
    sheetFallbackTitle: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.text,
      textAlign: 'center' as const,
    },
    sheetFallbackHint: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      textAlign: 'center' as const,
      maxWidth: 280,
    },
    sheetBodyPreview: {
      ...Platform.select({
        web: {
          paddingHorizontal: options.isNarrow ? 4 : 8,
        },
        default: {},
      }),
    },
    filtersPeek: {
      gap: 8,
      paddingHorizontal: options.isNarrow ? 8 : 12,
      paddingBottom: 2,
    },
    filtersModeBar: {
      paddingHorizontal: options.isNarrow ? 8 : 12,
      paddingTop: options.isNarrow ? 4 : 6,
      paddingBottom: options.isNarrow ? 2 : 2,
    },
    filtersPeekCtaRow: {
      paddingHorizontal: options.isNarrow ? 0 : 2,
      paddingBottom: 2,
    },
    fab: {
      bottom:
        Platform.OS === 'web'
          ? (`calc(${options.isNarrow ? 116 : 128}px + env(safe-area-inset-bottom) + ${MOBILE_WEB_BOTTOM_CHROME_GAP}px)` as any)
          : options.isNarrow
            ? 116
            : 128,
      right: options.isNarrow ? 12 : 14,
    },
    // Peek-строка шторки: «Искать места» + кнопка-иконка фильтров.
    peekRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: options.isNarrow ? 12 : 14,
      paddingTop: 2,
      paddingBottom: 4,
    },
    peekSearch: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: CONTROL_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    peekSearchText: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
    peekFiltersButton: {
      width: 44,
      height: 44,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.primary,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    // F-49 — «Искать в этой области» — pill по центру СНИЗУ (Google/Organic
    // Maps). Локация и список переехали в верхний icon-toolbar, поэтому снизу
    // остаётся только этот pill — держим его на комфортной высоте над нижним
    // доком/safe-area.
    searchAreaButton: {
      position: 'absolute' as const,
      alignSelf: 'center' as const,
      bottom: Platform.OS === 'web'
        ? (`calc(${options.isNarrow ? 96 : 104}px + env(safe-area-inset-bottom))` as any)
        : options.isNarrow
          ? 96
          : 104,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 7,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.primary,
      zIndex: 1450,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 4px 14px rgba(15,23,42,0.20)',
            cursor: 'pointer',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 5,
          }),
    },
    searchAreaButtonText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
    // Заголовок-строка открытой шторки.
    sheetSheetHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 8,
    },
    sheetSheetTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: '800' as const,
      color: colors.text,
    },
    sheetHeaderSpacer: {
      flex: 1,
      minWidth: 0,
    },
  })
