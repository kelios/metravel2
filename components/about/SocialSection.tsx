import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { aboutStyles } from './aboutStyles';

type Props = {
  onOpenInstagram: () => void;
};

export const SocialSection: React.FC<Props> = ({ onOpenInstagram }) => (
  <View style={aboutStyles.socialSection}>
    <Text style={aboutStyles.socialTitle}>Мы в социальных сетях</Text>
    <Pressable
      onPress={onOpenInstagram}
      style={({ pressed }) => [aboutStyles.socialButton, pressed && aboutStyles.socialButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel="@metravelby в Instagram"
    >
      <Text style={aboutStyles.socialIcon}>📷</Text>
      <Text style={aboutStyles.socialText}>@metravelby</Text>
    </Pressable>
  </View>
);
