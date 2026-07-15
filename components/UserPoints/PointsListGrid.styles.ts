import { Platform, StyleSheet } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { webTextStyle, webViewStyle } from '@/utils/webProps';
export const createLocalStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  mapLayoutContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  mapMainContent: {
    flex: 1,
  },
  mapRightPanel: {
    width: 440,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  panelTabs: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  rightPanelScroll: {
    flex: 1,
  },
  rightPanelContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  pointsList: {
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  listControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  listControlsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
    maxWidth: '100%',
  },
  listSearchInput: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    minWidth: 170,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.sm,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    ...(Platform.OS === 'web' ? webTextStyle({
      outlineWidth: 0,
      outlineStyle: 'none',
      outlineColor: 'transparent',
      transition: 'border-color 150ms ease, box-shadow 150ms ease',
    }) : null),
  },
  pointsListItem: {
    marginBottom: 12,
  },
  listProgressText: {
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: 16,
    marginHorizontal: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
  },
  recommendationsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  recommendationsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryDark,
    flex: 1,
  },
  routeInfo: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  routeInfoText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primaryDark,
  },
});
