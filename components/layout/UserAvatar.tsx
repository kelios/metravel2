import React, { useMemo } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl } from '@/utils/imageOptimization';

type UserAvatarProps = {
  uri: string | null;
  size?: 'sm' | 'md' | 'lg';
  onError?: () => void;
};

const SIZES = {
  sm: 20,
  md: 24,
  lg: 32,
} as const;

/**
 * Reusable avatar component for header sections.
 * Shows user image or fallback icon.
 */
function UserAvatar({ uri, size = 'md', onError }: UserAvatarProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors, SIZES[size]), [colors, size]);
  const webAvatarStyle = useMemo(
    () => createWebAvatarStyle(colors, SIZES[size]),
    [colors, size],
  );

  const px = SIZES[size];
  const optimizedUri = useMemo(
    () =>
      optimizeImageUrl(uri, {
        width: px * 2,
        height: px * 2,
        quality: 70,
        format: 'auto',
        fit: 'cover',
      }) ?? uri,
    [uri, px],
  );

  if (uri) {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.container}>
          <img
            src={optimizedUri ?? undefined}
            alt=""
            aria-hidden="true"
            width={px}
            height={px}
            decoding="async"
            referrerPolicy="no-referrer"
            style={webAvatarStyle}
            onError={onError}
          />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Image source={{ uri: optimizedUri ?? uri }} style={styles.avatar} onError={onError} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Feather name="user" size={SIZES[size]} color={colors.text} />
    </View>
  );
}

const createStyles = (colors: ThemedColors, size: number) =>
  StyleSheet.create({
    container: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatar: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
  });

const createWebAvatarStyle = (colors: ThemedColors, size: number): React.CSSProperties => ({
  width: size,
  height: size,
  display: 'block',
  borderRadius: size / 2,
  border: `1px solid ${colors.borderLight}`,
  objectFit: 'cover',
  backgroundColor: colors.surfaceMuted,
});

export default React.memo(UserAvatar);
