// components/MapPage/map/styles.ts
import { StyleSheet, Platform } from 'react-native';
import type { ThemedColors } from '@/hooks/useTheme';

export const getStyles = (colors: ThemedColors) => StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.backgroundSecondary,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 300
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center'
  },
  myLocationButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
    ...(Platform.OS === 'web' && {}),
  },
  myLocationButtonInner: {
    ...(Platform.OS === 'web' && {
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      backgroundColor: colors.info,
      border: `2px solid ${colors.borderStrong}`,
      boxShadow: colors.boxShadows.card,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      transition: 'all 0.2s ease',
      color: colors.textOnPrimary,
    }),
  } as any,
  routingProgress: {
    position: 'absolute',
    top: 60,
    left: '10%',
    right: '10%',
    backgroundColor: colors.info,
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routingProgressText: {
    color: colors.textOnPrimary,
    marginLeft: 8
  },
  routingError: {
    position: 'absolute',
    top: 20,
    left: '10%',
    right: '10%',
    backgroundColor: colors.danger,
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
    alignItems: 'center',
  },
  routingErrorText: {
    color: colors.textOnPrimary,
    fontWeight: '600'
  },
});

