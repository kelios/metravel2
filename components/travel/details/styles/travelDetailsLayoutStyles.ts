import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

import {
  COMPACT_SPACING,
  HEADER_OFFSET_DESKTOP,
  HEADER_OFFSET_MOBILE,
} from '../TravelDetailsStyleFragments'

const JOURNAL_FONT_FAMILY = "'Georgia', 'Times New Roman', 'Inter', serif"

export const createTravelDetailsLayoutStyles = (colors: ThemedColors) => ({
  // ✅ РЕДИЗАЙН: Светлый современный фон
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: { flex: 1 },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1600,
    width: '100%',
    marginHorizontal: 'auto' as any,
  },
  mainContainerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    maxWidth: '100%',
    marginHorizontal: 0 as any,
  },
  lazySectionReserved: {
    width: '100%',
    minHeight: Platform.select({
      web: 560,
      default: 520,
    }),
  },
  webDeferredSection: Platform.select({
    web: {
      // Defer render/paint for below-the-fold sections without CLS.
      contentVisibility: 'auto',
      contain: 'layout style paint',
      containIntrinsicSize: '720px 480px',
    } as any,
    default: {},
  }),
  // Optional sections (excursions/quests widgets) may resolve to empty. Reserve a
  // much smaller intrinsic size so an empty result does not leave a tall blank box
  // and trigger CLS once the real (small or zero) height is known.
  webOptionalDeferredSection: Platform.select({
    web: {
      contentVisibility: 'auto',
      contain: 'layout style paint',
      containIntrinsicSize: '720px 160px',
    } as any,
    default: {},
  }),

  // ✅ РЕДИЗАЙН: Адаптивное боковое меню
  sideMenuBase: {
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.borderStrong,
    borderStyle: 'solid',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.select({
      default: DESIGN_TOKENS.spacing.xxl,
      web: DESIGN_TOKENS.spacing.lg,
    }),
  },
  sectionContainer: {
    marginBottom: Platform.select({
      default: COMPACT_SPACING.section.desktop + 8, // 32px — больше воздуха между секциями
      web: COMPACT_SPACING.section.desktop + 8, // 32px — плотнее на desktop (UI-review #7)
    }),
    width: '100%',
  },

  contentStable: {
    // Предотвращает layout shift при загрузке контента
    minHeight: DESIGN_TOKENS.spacing.xxl,
  },

  contentOuter: {
    flex: 1,
  },

  contentWrapper: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({
          fontFamily: JOURNAL_FONT_FAMILY,
        } as any)
      : {}),
  },

  sectionTabsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },

  quickFactsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },

  sideMenuNative: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  sideMenuWebDesktop: {
    position: 'sticky' as any,
    top: HEADER_OFFSET_DESKTOP as any,
    backgroundColor: colors.surface,
    backdropFilter: 'blur(10px)' as any,
    // Ensure the sidebar can scroll independently on long menus
    maxHeight: `calc(100vh - ${HEADER_OFFSET_DESKTOP}px)` as any,
    overflowY: 'auto' as any,
    overflowX: 'hidden' as any,
    overscrollBehavior: 'contain' as any,
    display: 'flex' as any,
    flexDirection: 'column' as any,
    minHeight: 0 as any,
  },
  sideMenuWebMobile: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 0,
    maxHeight: '100vh' as any,
    overflowY: 'auto' as any,
    paddingTop: HEADER_OFFSET_MOBILE + DESIGN_TOKENS.spacing.xl,
  },
}) as const
