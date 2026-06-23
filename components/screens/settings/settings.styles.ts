import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import type { useThemedColors } from '@/hooks/useTheme';

const CARD_RADIUS = DESIGN_TOKENS.radii.lg;
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm;
const MEDIA_RADIUS = DESIGN_TOKENS.radii.md;
const PILL_RADIUS = DESIGN_TOKENS.radii.pill;

export const createSettingsStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.mutedBackground,
    },
    scrollContent: {
      paddingBottom: Platform.select({
        web: 24,
        default: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xxxl,
      }),
    },
    pageContainer: {
      width: '100%',
      paddingHorizontal: 16,
      ...Platform.select({
        web: {
          maxWidth: 760,
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingHorizontal: 20,
        },
      }),
    },
    header: {
      paddingTop: 16,
      paddingBottom: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: colors.textMuted,
    },
    section: {
      paddingTop: 6,
      paddingBottom: 24,
      gap: 14,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    subsectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.light,
        },
        ios: {
          shadowColor: colors.shadows.light.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profileHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profileActions: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    profileAvatar: {
      width: 36,
      height: 36,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    profileAvatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: PILL_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        web: {
          cursor: 'pointer',
        } as any,
      }),
    },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardText: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    cardMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
    },
    themeOptions: {
      gap: 10,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    themeOptionPressed: {
      opacity: 0.9,
    },
    themeOptionIcon: {
      width: 32,
      height: 32,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeOptionIconActive: {
      backgroundColor: colors.surface,
    },
    themeOptionText: {
      flex: 1,
    },
    themeOptionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    themeOptionDescription: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
    },
    settingsList: {
      gap: 10,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    settingTextBlock: {
      flex: 1,
      gap: 2,
    },
    settingTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    settingMeta: {
      fontSize: 12,
      color: colors.textMuted,
    },
    formGrid: {
      gap: 12,
      ...Platform.select({
        web: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: 12,
          rowGap: 12,
        } as any,
      }),
    },
    field: {
      gap: 6,
    },
    fieldHalf: {
      ...Platform.select({
        web: {
          flexBasis: 'calc(50% - 6px)' as any,
          flexGrow: 1,
          minWidth: 240,
        } as any,
      }),
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: CONTROL_RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    avatarRow: {
      gap: 12,
      ...Platform.select({
        web: {
          flexDirection: 'row',
          alignItems: 'flex-end',
        } as any,
      }),
    },
    avatarField: {
      flex: 1,
      minWidth: 240,
      gap: 6,
    },
    avatarPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    avatarPreview: {
      width: 64,
      height: 64,
      borderRadius: MEDIA_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarPreviewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    avatarPickerButtons: {
      gap: 10,
      ...Platform.select({
        web: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
        } as any,
      }),
    },
    avatarButtonWeb: {
      minWidth: 160,
    },
    avatarAction: {
      ...Platform.select({
        web: {
          width: 180,
        },
      }),
    },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 12,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.surface,
    },
    dangerButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.danger,
    },
    deleteAccountButton: {
      borderColor: colors.danger,
      backgroundColor: colors.danger,
    },
    deleteAccountButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerTitleBlock: {
      flex: 1,
    },
    backToProfileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      minHeight: 40,
    },
    backToProfileButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });
