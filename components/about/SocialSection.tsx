import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAboutStyles } from './aboutStyles';
import { globalFocusStyles } from '@/styles/globalFocus';

type Props = {
  onOpenInstagram: () => void;
};

export const SocialSection: React.FC<Props> = ({ onOpenInstagram }) => {
  const styles = useAboutStyles();
  return (
    <View style={styles.socialSection}>
      <Text style={styles.socialTitle}>Мы в социальных сетях</Text>
      <Pressable
        onPress={onOpenInstagram}
        style={({ pressed }) => [
          styles.socialButton,
          pressed && styles.socialButtonPressed,
          globalFocusStyles.focusable,
        ]}
        accessibilityRole="button"
        accessibilityLabel="@metravelby в Instagram"
      >
        <Text style={styles.socialIcon}>📷</Text>
        <Text style={styles.socialText}>@metravelby</Text>
      </Pressable>
    </View>
  );
};
