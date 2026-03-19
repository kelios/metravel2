// components/listTravel/recommendationsTabsStyles.ts
// E2: Styles extracted from RecommendationsTabs.tsx (~370 LOC)

import { StyleSheet, Platform } from 'react-native';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createTabCardTemplate } from './recommendationsCardTemplate';

const TAB_HEADER_HEIGHT = 56;
const TAB_CONTENT_HEIGHT = 320;
const TAB_TOTAL_HEIGHT = TAB_HEADER_HEIGHT + TAB_CONTENT_HEIGHT;

export { TAB_HEADER_HEIGHT, TAB_CONTENT_HEIGHT, TAB_TOTAL_HEIGHT };

export const createRecommendationsTabsStyles = (
  colors: ReturnType<typeof useThemedColors>,
  template: ReturnType<typeof createTabCardTemplate>,
) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight,
    ...Platform.select({ web: { boxShadow: colors.boxShadows.card } as any, default: colors.shadows.light }),
  },
  containerFixedHeight: { height: TAB_TOTAL_HEIGHT },
  header: {
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    minHeight: TAB_HEADER_HEIGHT, paddingHorizontal: 12, backgroundColor: colors.surface,
  },
  tabsScroll: {
    flex: 1,
    ...(Platform.select({ web: { overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain', width: '100%', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' } as any, default: {} }) as any),
  },
  tabsContainer: { paddingHorizontal: 0, paddingVertical: 10, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999, marginRight: 8, minHeight: 34, borderWidth: 1, borderColor: 'transparent',
  },
  activeTab: { backgroundColor: colors.primarySoft, borderColor: colors.border },
  tabLabel: { marginLeft: 6, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  activeTabLabel: { color: colors.primaryText, fontWeight: '600' },
  badge: {
    backgroundColor: colors.backgroundSecondary, borderRadius: 999, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', marginLeft: 6, paddingHorizontal: 6,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 4, height: 3, backgroundColor: colors.primary, borderRadius: 2, opacity: 0 },
  collapseButton: { paddingLeft: 10, paddingVertical: 12 },
  content: { height: TAB_CONTENT_HEIGHT, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surface },
  collapsedHeader: {
    height: TAB_HEADER_HEIGHT, justifyContent: 'center', paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.surface,
  },
  collapsedSpacer: { height: TAB_CONTENT_HEIGHT },
  tabPane: { height: TAB_CONTENT_HEIGHT, flex: 1 },
  tabPaneScroll: {
    flex: 1,
    ...(Platform.select({ web: { width: '100%', overflowX: 'visible', overflowY: 'visible' } as any, default: {} }) as any),
  },
  tabPaneContent: {
    flexGrow: 1, paddingVertical: 4, alignItems: 'stretch',
    ...(Platform.select({ web: { width: '100%', overflowX: 'visible', overflowY: 'visible' } as any, default: {} }) as any),
  },
  gateContainer: { paddingHorizontal: 0, paddingVertical: 12 },
  gateCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16,
    backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.borderAccent,
  },
  gateIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  gateCopy: { flex: 1, marginLeft: 12, marginRight: 12 },
  gateText: { fontSize: 14, color: colors.textMuted, lineHeight: 20, fontWeight: '500' },
  gateButton: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface,
  },
  gateButtonText: { color: colors.primaryText, fontSize: 14, fontWeight: '600' },
  collapsedContainer: { paddingVertical: 12, paddingHorizontal: 0, backgroundColor: colors.backgroundSecondary, borderRadius: 16 },
  expandButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  expandText: { marginLeft: 8, fontSize: 15, color: colors.primaryText, fontWeight: '500' },
  placeholderContainer: { paddingVertical: 16, paddingHorizontal: 0 },
  skeletonCard: {
    width: template.container.width || 208, marginRight: 16, backgroundColor: colors.surface,
    borderRadius: template.container.borderRadius || 12, overflow: 'hidden',
  },
  skeletonImage: { height: (template.imageContainer as any).height || 136, backgroundColor: colors.backgroundSecondary },
  skeletonContent: { padding: (template.content as any).padding || 12 },
  skeletonLine: { height: 14, backgroundColor: colors.borderLight, borderRadius: 7 },
  skeletonMetaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  emptyState: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 40, width: '100%',
    borderRadius: 16, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.borderLight,
  },
  emptyText: { marginTop: 12, fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  errorContainer: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  errorText: { marginTop: 12, fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  horizontalList: { marginBottom: 8 },
  webHorizontalScroll: {
    ...(Platform.select({ web: { overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain', width: '100%', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' } as any, default: {} }) as any),
  },
  webHorizontalScrollContent: {
    flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, paddingBottom: 6,
    ...(Platform.select({ web: { width: 'max-content' } as any, default: {} }) as any),
  },
  horizontalListContent: {
    paddingHorizontal: 4, paddingBottom: 6,
    ...Platform.select({ web: { paddingBottom: 12 } as any, default: {} }),
  },
  mobileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 12,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  mobileGridItem: {
    width: '48%',
    minWidth: 0,
  },
  favoritesHeaderRow: {
    paddingHorizontal: 0, paddingTop: 4, paddingBottom: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  headerTitleBlock: { flex: 1 },
  headerSubtitle: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seeAllButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.primarySoft,
  },
  seeAllButtonText: { fontSize: 13, fontWeight: '600', color: colors.primaryText },
  favoritesHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  favoritesClearButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  favoritesClearButtonText: { fontSize: 13, fontWeight: '600', color: colors.danger },
});
