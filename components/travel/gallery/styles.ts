import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

export const createGalleryStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      padding: DESIGN_TOKENS.spacing.xl,
      width: '100%',
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
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'visible',
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
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
      backgroundColor: 'rgba(0,0,0,0.75)',
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      elevation: 9999,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    dropzone: {
      width: '100%',
      padding: DESIGN_TOKENS.spacing.lg,
      borderWidth: 2,
      borderRadius: DESIGN_TOKENS.radii.md,
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.xl,
    },
    activeDropzone: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.primarySoft,
    },
    dropzoneText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    noImagesText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      textAlign: 'center',
      marginTop: DESIGN_TOKENS.spacing.xl,
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
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
    },
    batchProgressBar: {
      width: '100%',
      height: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      overflow: 'hidden',
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    batchProgressFill: {
      height: '100%',
    },
    batchProgressText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      textAlign: 'center',
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
