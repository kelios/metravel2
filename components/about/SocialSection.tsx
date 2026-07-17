import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAboutStyles } from './aboutStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


type Props = {
  onOpenFacebook: () => void;
  onOpenInstagram: () => void;
};

export const SocialSection: React.FC<Props> = ({ onOpenFacebook, onOpenInstagram }) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
  return (
    <View style={styles.socialSection}>
      <Text style={styles.socialTitle}>{i18nT('home:components.about.SocialSection.my_v_sotsialnyh_setyah_9f292461')}</Text>
      <View style={styles.socialButtonsRow}>
        <Pressable
          onPress={onOpenFacebook}
          style={({ pressed }) => [
            styles.socialButton,
            pressed && styles.socialButtonPressed,
            globalFocusStyles.focusable,
          ]}
          accessibilityRole="link"
          accessibilityLabel={i18nT('home:components.about.SocialSection.metravel_v_facebook_8fd84034')}
        >
          <Feather name="facebook" size={24} color={colors.primaryDark} />
          <Text style={styles.socialText}>{i18nT('home:components.about.SocialSection.metravel_facebook_page_44621380')}</Text>
        </Pressable>
        <Pressable
          onPress={onOpenInstagram}
          style={({ pressed }) => [
            styles.socialButton,
            pressed && styles.socialButtonPressed,
            globalFocusStyles.focusable,
          ]}
          accessibilityRole="link"
          accessibilityLabel={i18nT('home:components.about.SocialSection.metravelby_v_instagram_9da0e3e1')}
        >
          <Feather name="instagram" size={24} color={colors.primaryDark} />
          <Text style={styles.socialText}>{i18nT('home:components.about.SocialSection.metravelby_0868cf05')}</Text>
        </Pressable>
      </View>
    </View>
  );
};
