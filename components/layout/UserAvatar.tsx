import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

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

  if (uri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri }} style={styles.avatar} onError={onError} />
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

export default React.memo(UserAvatar);
