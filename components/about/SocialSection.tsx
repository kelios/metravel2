import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAboutStyles } from './aboutStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
  onOpenInstagram: () => void;
};

export const SocialSection: React.FC<Props> = ({ onOpenInstagram }) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
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
        <Feather name="instagram" size={24} color={colors.primary} />
        <Text style={styles.socialText}>@metravelby</Text>
      </Pressable>
    </View>
  );
};
