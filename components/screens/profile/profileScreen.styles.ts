import { StyleSheet, Platform } from 'react-native';

interface CreateProfileScreenStylesArgs {
  colors: { background: string };
  contentPadding: number;
  gapSize: number;
  isDesktopWeb: boolean;
  maxContentWidth: number;
}

export const createProfileScreenStyles = ({
  colors,
  contentPadding,
  gapSize,
  isDesktopWeb,
  maxContentWidth,
}: CreateProfileScreenStylesArgs) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: contentPadding,
      paddingBottom: 0,
      paddingTop: 12,
      rowGap: gapSize,
      maxWidth: Platform.OS === 'web' ? (isDesktopWeb ? maxContentWidth : undefined) : undefined,
      alignSelf: Platform.OS === 'web' ? 'center' : undefined,
      width: Platform.OS === 'web' ? '100%' : undefined,
    },
    headerComponent: {
      backgroundColor: colors.background,
    },
    fullRow: {
      width: '100%',
    },
    cardsRow: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      maxWidth: '100%',
      minWidth: 0,
      alignItems: 'flex-start',
      ...Platform.select({
        web: {
          columnGap: gapSize,
          rowGap: gapSize,
        },
        default: {},
      }),
    },
    rowSeparator: {
      height: gapSize,
    },
    emptyWrap: {
      paddingHorizontal: contentPadding,
      paddingTop: 16,
    },
    skeletonWrap: {
      gap: 0,
      overflow: 'hidden',
    },
    skeletonIdentityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 16,
      marginTop: -45,
      paddingBottom: 12,
    },
    skeletonIdentityText: {
      flex: 1,
      gap: 8,
      paddingTop: 48,
    },
    skeletonStatsRow: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    skeletonListWrap: {
      marginTop: 16,
      gap: 12,
    },
    tabActions: {
      paddingHorizontal: contentPadding,
      paddingTop: 12,
      paddingBottom: 8,
    },
    tabActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    footerLoader: {
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
