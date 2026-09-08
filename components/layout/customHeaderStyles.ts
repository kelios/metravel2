import { Platform, StatusBar, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';

const PANEL_RADIUS = DESIGN_TOKENS.radii.lg;
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm;
const CONTROL_SIZE = 44;

/**
 * #1298: ширина, которую desktop-шапка резервирует под аккаунт-секцию. Секция
 * auth-зависимая и монтируется только после гидратации (SSR даёт React #419),
 * поэтому её появление раньше уводило переключатель языка влево на 239 px
 * (замер прода 2026-08-06: `x 1155 -> 916`). Резерв держит бокс постоянным:
 * контент прижат вправо (`justifyContent: flex-end`), поэтому правый край не
 * меняется.
 *
 * #1879: резерв обязан быть ФИКСИРОВАННОЙ шириной, а не минимальной. С
 * `minWidth` бокс оставался нижней границей и рос под контент, а слева от него
 * стоит `navScroll` с `flex:1` — весь слак строки живёт левее переключателя
 * языка, поэтому любой прирост правой группы уводит переключатель влево. При
 * прежних 224 px RU проходил с запасом 0.37 px: субпиксельный разброс отрисовки
 * перекладывал бокс через границу и давал горизонтальный сдвиг
 * `header-language-switcher` примерно через прогон, а BE и PL раздвигали резерв
 * всегда.
 *
 * Арифметика самой узкой desktop-строки (замеры prod-сборки на 1280 px):
 * контентный бокс строки 1217 px, из них фиксировано 274.89 (логотип 114.89 +
 * зазоры 72 + переключатель 88), на навигацию и слот аккаунта остаётся 942.11.
 *   локаль | ссылки навигации | гостевой кластер «Войти» + «Гость»
 *   BE     | 703.66           | 237.95
 *   RU     | 697.73           | 223.63
 *   UK     | 692.36           | 222.83
 *   PL     | 592.88           | 251.03
 *   EN     | 589.17           | 219.67
 * BE упирается в потолок: 703.66 + 237.95 = 941.61 из 942.11. Резерва, который
 * разом вмещал бы кластер PL (251.03) и ссылки BE, не существует — 238 px это
 * максимум, при котором навигация BE ещё не уходит в скролл, и одновременно
 * минимум, вмещающий кластер BE целиком. RU/UK/EN укладываются с запасом
 * 14–18 px. Локали шире резерва (PL) сжимают якорь аккаунта многоточием
 * (`flexShrink` в `headerStyles.ts`), а не двигают соседей.
 *
 * Ниже 1280 px правая группа — `rightSectionMobile` c `flex:1`, навигации нет,
 * и переключатель прижат к ЛЕВОМУ краю строки: этот класс сдвигов туда не
 * доходит вовсе.
 */
export const HEADER_ACCOUNT_SLOT_WIDTH = 238;

/**
 * Creates styles for CustomHeader component.
 * Extracted to reduce component file size and improve maintainability.
 */
export const createCustomHeaderStyles = (
  colors: ThemedColors,
  isMobile: boolean,
  safeAreaTop = 0,
) => {
  const iosTopInset =
    Platform.OS === 'ios' && Number.isFinite(safeAreaTop) ? Math.max(0, safeAreaTop) : 0;

  return StyleSheet.create({
    container: {
      backgroundColor: Platform.OS === 'web' ? colors.background : colors.surface,
      paddingTop: iosTopInset,
      paddingBottom: Platform.OS === 'web' ? (isMobile ? 6 : 12) : 0,
      borderBottomWidth: Platform.OS === 'web' ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: colors.border,
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 2000,
            width: '100%',
          } as any)
        : { zIndex: 10 }),
    },
    wrapper: {
      width: '100%',
      backgroundColor: Platform.OS === 'web' ? colors.background : colors.surface,
      ...Platform.select({
        ios: {
          ...DESIGN_TOKENS.shadowsNative.light,
        },
        android: {
          elevation: 3,
          shadowColor: DESIGN_TOKENS.shadowsNative.light.shadowColor,
        },
        web: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          boxShadow: DESIGN_TOKENS.shadows.card as any,
        },
      }),
    },
    inner: {
      width: '100%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      ...Platform.select({
        ios: {
          minHeight: 44,
          paddingTop: 8,
        },
        android: {
          minHeight: 48,
          paddingTop: (StatusBar.currentHeight || 0) + 6,
        },
        web: {
          minHeight: 56,
          paddingHorizontal: isMobile ? 8 : 24,
          paddingVertical: isMobile ? 6 : 10,
        },
      }),
      ...(Platform.OS === 'web' && {
        marginLeft: 'auto',
        marginRight: 'auto',
      }),
    },
    innerMobile: {
      paddingHorizontal: 6,
    },
    navContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 4,
      justifyContent: 'center',
    },
    navScroll: {
      flex: 1,
      marginHorizontal: 12,
      minHeight: 44,
    },
    iconSlot18: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconSlot20: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconSlot24: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
      justifyContent: 'flex-end',
      ...(Platform.OS === 'web' && !isMobile
        ? { width: HEADER_ACCOUNT_SLOT_WIDTH, flexGrow: 0 }
        : null),
    },
    rightSectionMobile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      justifyContent: 'flex-end',
    },
    mobileUserPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      gap: 6,
      minHeight: 44,
      flexShrink: 1,
      minWidth: isMobile ? 116 : 0,
    },
    mobileUserPillPlaceholder: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      maxWidth: 180,
      gap: 6,
      minHeight: 44,
      minWidth: isMobile ? 116 : undefined,
      opacity: 0,
    },
    mobileUserAvatarContainer: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    mobileUserAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    mobileUserName: {
      fontSize: 16,
      color: colors.text,
      flexShrink: 1,
      minWidth: isMobile ? 64 : 48,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 9,
      paddingVertical: 8,
      borderRadius: 999,
      gap: 6,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
      flexShrink: 0,
      ...Platform.select({
        web: {
          transition: 'background-color 0.15s ease-out' as any,
          cursor: 'pointer' as any,
        },
      }),
    },
    navItemHover: {
      backgroundColor: colors.primarySoft,
    },
    navItemActive: {
      backgroundColor: colors.brandLight,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light as any,
        },
      }),
    },
    navLabel: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      letterSpacing: 0,
    },
    navLabelActive: {
      color: colors.brandText,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      letterSpacing: 0,
    },
    mobileMenuButton: {
      width: CONTROL_SIZE,
      height: CONTROL_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: CONTROL_RADIUS,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      flexShrink: 0,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.brand,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      gap: 8,
      minHeight: 44,
      minWidth: 44,
      ...Platform.select({
        web: {
          transition:
            'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease' as any,
          cursor: 'pointer' as any,
          boxShadow: ((colors.boxShadows as any)?.light ?? DESIGN_TOKENS.shadows.light) as any,
        },
      }),
    },
    createButtonHover: {
      opacity: 0.96,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)' as any,
          boxShadow: DESIGN_TOKENS.shadows.heavy as any,
          filter: 'brightness(0.98)' as any,
        },
      }),
    },
    createLabel: {
      color: colors.textOnPrimary,
      fontSize: 14,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      letterSpacing: 0,
    },
    createIconComposite: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    createIconPlus: {
      position: 'absolute',
      top: -4,
      right: -4,
    },
    createIconPin: {
      position: 'absolute',
      bottom: -4,
      right: -4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
      ...(Platform.OS === 'web'
        ? ({
            position: 'fixed',
            inset: 0,
            zIndex: 6000,
          } as any)
        : null),
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: PANEL_RADIUS,
      borderTopRightRadius: PANEL_RADIUS,
      maxHeight: '86%',
      paddingBottom: 12,
      overflow: 'hidden',
      borderWidth: Platform.OS === 'web' ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.borderLight,
      zIndex: 6001,
      ...Platform.select({
        web: {
          position: 'relative',
          boxShadow: ((colors.boxShadows as any)?.modal ?? DESIGN_TOKENS.shadows.modal) as any,
          backdropFilter: 'blur(18px) saturate(1.05)' as any,
          WebkitBackdropFilter: 'blur(18px) saturate(1.05)' as any,
        } as any,
      }),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    modalCloseButton: {
      width: CONTROL_SIZE,
      height: CONTROL_SIZE,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    modalNavContainer: {
      paddingVertical: 10,
    },
    modalSectionTitle: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    modalNavItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 12,
      minHeight: 46,
      marginHorizontal: 10,
      borderRadius: CONTROL_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    modalNavItemHover: {
      backgroundColor: colors.surfaceMuted,
    },
    modalNavItemActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryAlpha30,
    },
    modalNavLabel: {
      fontSize: 15,
      color: colors.textMuted,
      fontWeight: '500',
      flex: 1,
    },
    modalNavLabelActive: {
      color: colors.primaryText,
      fontWeight: '600',
    },
    modalDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 8,
      marginHorizontal: 16,
    },
  });
};

export const webStickyStyle =
  Platform.OS === 'web'
    ? { position: 'sticky' as const, top: 0, zIndex: 2000, width: '100%' }
    : null;
