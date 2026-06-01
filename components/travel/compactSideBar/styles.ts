import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

import { SIDEBAR_WEATHER_RESERVE_HEIGHT } from './helpers'

export const weatherPlaceholderStyle = {
  position: 'absolute' as const,
  inset: 0 as any,
  minHeight: SIDEBAR_WEATHER_RESERVE_HEIGHT,
  width: '100%' as const,
  paddingTop: 10,
  pointerEvents: 'none' as const,
}

export const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface,
      ...((Platform.OS === 'web')
        ? {
            position: 'relative' as any,
            display: 'flex' as any,
            flexDirection: 'column' as any,
            minHeight: 0 as any,
          }
        : {}),
    },
    menuFrame: {
      flex: 1,
      minHeight: 0,
      ...((Platform.OS === 'web')
        ? {
            height: '100%' as any,
            maxHeight: '100%' as any,
            overflow: 'hidden' as any,
          }
        : {}),
    },
    menu: {
      paddingTop: 16,
      alignSelf: 'flex-start',
      ...((Platform.OS === 'web')
        ? {
            maxWidth: 350,
            flex: 1,
            height: '100%' as any,
            maxHeight: '100%' as any,
            minHeight: 0 as any,
            overflowY: 'auto' as any,
            overflowX: 'hidden' as any,
            overscrollBehavior: 'contain' as any,
            width: '100%',
            alignSelf: 'stretch' as any,
          }
        : {}),
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: 14,
      marginBottom: (Platform.OS === 'web') ? 8 : 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden' as const,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: (Platform.OS === 'web') ? DESIGN_TOKENS.spacing.xs : DESIGN_TOKENS.spacing.sm,
    },
    avatarWrap: {
      marginRight: DESIGN_TOKENS.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...((Platform.OS === 'web') ? ({ position: 'relative' as any }) : {}),
    },
    avatar: {
      width: (Platform.OS === 'web') ? 44 : 50,
      height: (Platform.OS === 'web') ? 44 : 50,
      borderRadius: (Platform.OS === 'web') ? 22 : 25,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    avatarPlaceholder: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.borderLight,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      marginLeft: 'auto',
      flexShrink: 0,
      alignSelf: 'center',
    },
    actionBtn: {
      width: (Platform.OS === 'web') ? 40 : 42,
      height: (Platform.OS === 'web') ? 40 : 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...((Platform.OS === 'web')
        ? ({
            cursor: 'pointer' as any,
            transition: 'background-color 0.15s ease, border-color 0.15s ease' as any,
            ':hover': {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
            } as any,
          } as any)
        : {}),
    },
    actionBtnPressed: { opacity: 0.85, backgroundColor: colors.backgroundSecondary },
    actionBtnDisabled: { opacity: 0.4, backgroundColor: colors.backgroundSecondary },
    userNameWrap: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
    userName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      fontFamily: 'Georgia',
      flexShrink: 1,
      lineHeight: (Platform.OS === 'web') ? 19 : 20,
      letterSpacing: -0.2,
    },
    userNamePrimary: { fontWeight: '800', color: colors.text },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      columnGap: 10,
      marginTop: 6,
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
    },
    metaText: {
      fontSize: (Platform.OS === 'web') ? 12 : 13,
      color: colors.textMuted,
      fontFamily: 'Georgia',
      fontWeight: '500',
      lineHeight: (Platform.OS === 'web') ? 18 : 20,
      flexShrink: 1,
    },
    link: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: (Platform.OS === 'web') ? 38 : 40,
      paddingVertical: (Platform.OS === 'web') ? 8 : 10,
      paddingHorizontal: 12,
      paddingLeft: (Platform.OS === 'web') ? 16 : 18,
      borderRadius: 12,
      marginBottom: (Platform.OS === 'web') ? 2 : 4,
      width: '100%',
      maxWidth: '100%',
      justifyContent: 'space-between',
      backgroundColor: 'transparent',
      ...((Platform.OS === 'web')
        ? {
            cursor: 'pointer' as any,
            transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ':hover': { backgroundColor: colors.backgroundSecondary } as any,
          }
        : {}),
    },
    linkLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
    activeIndicator: {
      position: 'absolute',
      left: 0,
      top: '50%',
      marginTop: (Platform.OS === 'web') ? -9 : -12,
      height: (Platform.OS === 'web') ? 18 : 24,
      width: 3,
      borderRadius: 999,
      backgroundColor: 'transparent',
      ...((Platform.OS === 'web') ? { transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' } : {}),
    },
    activeIndicatorActive: { backgroundColor: colors.primary, width: 4 },
    linkPressed: { backgroundColor: colors.primarySoft },
    linkActive: { backgroundColor: colors.primaryLight },
    linkTxt: {
      marginLeft: 10,
      fontSize: (Platform.OS === 'web') ? 14 : 15,
      fontFamily: 'Georgia',
      color: colors.text,
      fontWeight: '500',
      lineHeight: (Platform.OS === 'web') ? 20 : 22,
      ...((Platform.OS === 'web') ? ({ transition: 'color 0.2s ease' } as any) : {}),
    },
    linkTxtActive: { color: colors.primaryText, fontWeight: '700' },
    linkMetaPill: {
      marginLeft: (Platform.OS === 'web') ? 8 : 10,
      paddingHorizontal: (Platform.OS === 'web') ? 6 : 8,
      paddingVertical: (Platform.OS === 'web') ? 2 : 3,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      flexShrink: 1,
      maxWidth: (Platform.OS === 'web') ? 120 : 140,
    },
    linkMetaText: {
      fontSize: (Platform.OS === 'web') ? 12 : 14,
      color: colors.textMuted,
      fontFamily: 'Georgia',
      fontWeight: '600',
      lineHeight: (Platform.OS === 'web') ? 16 : 18,
      flexWrap: 'wrap',
    },
    linkDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: (Platform.OS === 'web') ? 10 : 16,
      marginHorizontal: 12,
      ...((Platform.OS === 'web')
        ? ({
            backgroundImage: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
            backgroundRepeat: 'no-repeat',
          } as any)
        : {}),
    },
    allTravelsWrap: { marginTop: DESIGN_TOKENS.spacing.xs, alignSelf: 'flex-start' },
    allTravelsButton: {
      alignSelf: 'flex-start',
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'transparent',
      borderColor: colors.borderLight,
    },
    allTravelsButtonLabel: {
      color: colors.primary,
      fontWeight: '600',
      textAlign: 'center',
    },
    closeBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.primaryDark,
      paddingVertical: DESIGN_TOKENS.spacing.lg,
      alignItems: 'center',
    },
    closeBtn: { flexDirection: 'row', alignItems: 'center' },
    closeBtnPressed: { opacity: 0.7 },
    closeTxt: {
      color: colors.textOnDark,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontFamily: 'Georgia',
      marginLeft: 8,
    },
    closeTopBar: {
      alignItems: 'flex-end',
      marginBottom: DESIGN_TOKENS.spacing.sm,
      paddingRight: 4,
    },
    closeTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    closeTopBtnPressed: { opacity: 0.7 },
    fallback: { paddingVertical: 40, alignItems: 'center' },
  })
