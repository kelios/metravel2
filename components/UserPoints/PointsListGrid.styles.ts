import { Platform, StyleSheet } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { webTextStyle, webViewStyle } from '@/utils/webProps';
import { resolveExportedFunction } from '@/utils/moduleInterop';
import React, { useMemo } from 'react';
import type FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings';
type MapSettingsStyles = React.ComponentProps<typeof FiltersPanelMapSettings>['styles'];
type FiltersPanelStylesResolver = (colors: unknown, isMobile: boolean, windowWidth: number) => MapSettingsStyles;

let getFiltersPanelStylesSafe: FiltersPanelStylesResolver | null = null;
try {
  const mod = require('@/components/MapPage/filtersPanelStyles');
  getFiltersPanelStylesSafe = resolveExportedFunction(mod, 'getFiltersPanelStyles') as FiltersPanelStylesResolver | null;
} catch {
  getFiltersPanelStylesSafe = null;
}

const EMPTY_MAP_SETTINGS_STYLES = {} as MapSettingsStyles;

/** Стили блока настроек карты из общей карты (модуль грузится мягко — без него блок пустой). */
export const useMapSettingsStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isMobile: boolean,
  windowWidth: number,
): MapSettingsStyles =>
  useMemo(
    () => getFiltersPanelStylesSafe?.(colors, isMobile, windowWidth) ?? EMPTY_MAP_SETTINGS_STYLES,
    [colors, isMobile, windowWidth],
  );

/** Ширина правой панели на широком экране — как у общей карты. */
const RIGHT_PANEL_WIDTH = 440
/** Внутренний отступ панели: между шагами токенов md (16) и lg (24). */
const PANEL_GUTTER = 20
/** Зазоры ряда управления над списком: между xs (8) и sm (12) — ряд должен уместиться на 320 px. */
const CONTROLS_GAP = 10
const CONTROLS_GAP_TIGHT = 6
const RECOMMENDATIONS_PADDING_Y = 14
const HINT_MIN_WIDTH = 180

export const createLocalStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  mapLayoutContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  mapMainContent: {
    flex: 1,
  },
  mapRightPanel: {
    width: RIGHT_PANEL_WIDTH,
    borderLeftWidth: 0,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web'
      ? webViewStyle({
          boxShadow: colors.boxShadows.card,
          zIndex: 2,
        })
      : null),
  },
  mobilePanelContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileTabsBar: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  panelTabs: {
    paddingHorizontal: PANEL_GUTTER,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  rightPanelScroll: {
    flex: 1,
  },
  rightPanelContent: {
    paddingHorizontal: PANEL_GUTTER,
    paddingTop: PANEL_GUTTER,
    paddingBottom: PANEL_GUTTER * 2,
  },
  pointsList: {
    paddingTop: DESIGN_TOKENS.spacing.sm,
    paddingBottom: DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  listControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: CONTROLS_GAP,
    marginBottom: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.xxs,
  },
  listControlsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: CONTROLS_GAP_TIGHT,
    flexShrink: 1,
    maxWidth: '100%',
  },
  listSearchInput: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    minWidth: 170,
    height: DESIGN_TOKENS.touchTarget.minHeight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.scale.body.fontSize,
    ...(Platform.OS === 'web' ? webTextStyle({
      outlineWidth: 0,
      outlineStyle: 'none',
      outlineColor: 'transparent',
      transition: 'border-color 150ms ease, box-shadow 150ms ease',
    }) : null),
  },
  pointsListItem: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: RECOMMENDATIONS_PADDING_Y,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    marginHorizontal: DESIGN_TOKENS.spacing.xxs,
    gap: DESIGN_TOKENS.spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
  },
  recommendationsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    flexShrink: 0,
  },
  // PERM-3: подсказка + CTA «определить местоположение» под шапкой рекомендаций.
  recommendationsLocationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.md,
    marginHorizontal: DESIGN_TOKENS.spacing.xxs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  recommendationsLocationHint: {
    flex: 1,
    minWidth: HINT_MIN_WIDTH,
    fontSize: DESIGN_TOKENS.typography.scale.bodySmall.fontSize,
    color: colors.textMuted,
  },
  recommendationsTitle: {
    fontSize: DESIGN_TOKENS.typography.scale.body.fontSize,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold,
    color: colors.primaryDark,
    flex: 1,
  },
  routeInfo: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  routeInfoText: {
    fontSize: DESIGN_TOKENS.typography.scale.bodySmall.fontSize,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
    color: colors.primaryDark,
  },
});
