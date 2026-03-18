import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

export const createGalleryStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      padding: DESIGN_TOKENS.spacing.xl,
      width: '100%',
      // ✅ УЛУЧШЕНИЕ: Добавлен фон для галереи
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.light,
        },
        default: colors.shadows.light,
      }),
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    galleryTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xl,
      fontWeight: 'bold',
    },
    imageCount: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    highlight: {
      fontWeight: 'bold',
    },
    galleryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
      justifyContent: 'flex-start',
    },
    imageWrapper: {
      flexBasis: '32%',
      maxWidth: '32%',
      minWidth: 220,
      minHeight: 220,
      flexGrow: 0,
      aspectRatio: 1,
      borderRadius: DESIGN_TOKENS.radii.lg,
      overflow: 'hidden', // ✅ ИСПРАВЛЕНИЕ: overflow hidden для rounded corners
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      // ✅ УЛУЧШЕНИЕ: Добавлена тень для карточек изображений
      ...Platform.select({
        web: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.2s ease',
          ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          },
        },
        default: {
          shadowColor: DESIGN_TOKENS.colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
      }),
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: DESIGN_TOKENS.radii.md,
    },
    deleteButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      // ✅ УЛУЧШЕНИЕ: Минимальный touch target 44x44
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      elevation: 9999,
      // ✅ УЛУЧШЕНИЕ: Улучшенный фон с blur эффектом
      backgroundColor: colors.danger,
      borderWidth: 2,
      borderColor: colors.textOnDark,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          ':hover': {
            transform: 'scale(1.1)',
            backgroundColor: colors.dangerDark,
            boxShadow: `0 4px 12px ${colors.dangerSoft}`,
          },
          ':active': {
            transform: 'scale(0.95)',
          },
        },
        default: {
          shadowColor: DESIGN_TOKENS.colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
      }),
    },
    dropzone: {
      width: '100%',
      padding: DESIGN_TOKENS.spacing.xl,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: DESIGN_TOKENS.spacing.xl,
      minHeight: 120,
      // ✅ УЛУЧШЕНИЕ: Улучшенные стили для dropzone
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({
        web: {
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          ':hover': {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
          },
        },
      }),
    },
    activeDropzone: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      borderStyle: 'solid',
      // ✅ УЛУЧШЕНИЕ: Анимация при драге
      ...Platform.select({
        web: {
          transform: 'scale(1.02)',
          boxShadow: `0 0 0 4px ${colors.primaryAlpha30}`,
        },
      }),
    },
    dropzoneText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    emptyGalleryContainer: {
      paddingVertical: DESIGN_TOKENS.spacing.xxl * 2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.md,
    },
    noImagesText: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    emptyGalleryHint: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      textAlign: 'center',
      opacity: 0.7,
    },
    loader: {
      marginTop: DESIGN_TOKENS.spacing.xl,
    },
    skeleton: {
      width: '100%',
      height: '100%',
    },
    uploadingImageContainer: {
      width: '100%',
      height: '100%',
      position: 'relative',
    },
    uploadingOverlayImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadingImageText: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '600',
    },
    errorImageContainer: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.warningSoft,
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.warningLight,
      position: 'relative',
    },
    errorImage: {
      opacity: 0.08,
    },
    errorOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.overlayLight,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    errorOverlaySubtext: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    errorActionButton: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.sm,
      shadowColor: 'transparent',
    },
    errorActionText: {
      fontWeight: '700',
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      textDecorationLine: 'none',
    },
    batchProgressContainer: {
      marginBottom: DESIGN_TOKENS.spacing.lg,
      padding: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 8px ${colors.primaryAlpha30}`,
        },
        default: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 2,
        },
      }),
    },
    batchProgressBar: {
      width: '100%',
      height: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      overflow: 'hidden',
      marginBottom: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    batchProgressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      ...Platform.select({
        web: {
          transition: 'width 0.3s ease',
          backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)',
          backgroundSize: '30px 30px',
          animation: 'progress-animation 1s linear infinite',
        },
      }),
    },
    batchProgressText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.text,
    },
    errorBanner: {
      marginTop: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    errorBannerText: {
      fontSize: 13,
      textAlign: 'left',
    },
  })
