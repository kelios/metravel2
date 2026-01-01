import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Paragraph } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAboutStyles } from './aboutStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
  email: string;
  onSendMail: () => void;
  onOpenUrl: (url: string) => void;
  onOpenPrivacy: () => void;
  onOpenCookies: () => void;
  socialLinks: { instagram: string; tiktok: string; youtube: string };
};

export const AboutIntroCard: React.FC<Props> = ({
  email,
  onSendMail,
  onOpenUrl,
  onOpenPrivacy,
  onOpenCookies,
  socialLinks,
}) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
  return (
  <View style={styles.infoCard}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>О проекте</Text>
    </View>
    <Paragraph style={styles.paragraph}>
      MeTravel.by – это некоммерческий проект для путешественников, где каждый может поделиться своими
      маршрутами и открытиями.
    </Paragraph>

    <View style={styles.sectionDivider} />

    <Text style={styles.sectionTitle}>Как поделиться путешествием:</Text>
    <View style={styles.stepsList} accessibilityRole="list">
      {['Регистрируемся', 'Добавляем своё путешествие', 'Ставим статус «Опубликовать»', 'Ждём модерации (до 24 часов)', 'Хотите в Instagram? Напишите в директ @metravelby'].map(
        (text, idx) => (
          <View key={text} style={styles.stepItem} accessibilityRole="text">
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{idx + 1}</Text>
            </View>
            <Text style={styles.stepText}>{text}</Text>
          </View>
        ),
      )}
    </View>

    <View style={styles.sectionDivider} />

    <View style={styles.footerInfo}>
      <Text style={styles.footerText}>
        Проект запущен в июне 2020. Использование материалов — только с разрешения автора.
      </Text>
      <Text style={styles.contactLabel}>Идеи, отзывы и предложения:</Text>
      <Pressable
        onPress={onSendMail}
        accessibilityRole="button"
        accessibilityLabel="Написать на электронную почту"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.emailButton, pressed && styles.emailButtonPressed]}
      >
        <Text style={styles.emailIcon}>✉</Text>
        <Text style={styles.emailText}>{email}</Text>
      </Pressable>

      <View style={styles.linksBlock}>
        <View style={styles.socialRow}>
          <Pressable
            onPress={() => onOpenUrl(socialLinks.tiktok)}
            accessibilityRole="link"
            accessibilityLabel="MeTravel в TikTok"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconLink,
              pressed && styles.iconLinkPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <FontAwesome5 name="tiktok" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => onOpenUrl(socialLinks.instagram)}
            accessibilityRole="link"
            accessibilityLabel="MeTravel в Instagram"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconLink,
              pressed && styles.iconLinkPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <FontAwesome5 name="instagram" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => onOpenUrl(socialLinks.youtube)}
            accessibilityRole="link"
            accessibilityLabel="MeTravel на YouTube"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconLink,
              pressed && styles.iconLinkPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <FontAwesome5 name="youtube" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.utilityLinksRow}>
          <Pressable
            onPress={onOpenPrivacy}
            accessibilityRole="link"
            accessibilityLabel="Политика конфиденциальности"
            hitSlop={8}
            style={({ pressed }) => [styles.textLink, pressed && styles.textLinkPressed, globalFocusStyles.focusable]}
          >
            <Text style={styles.textLinkLabel}>Политика конфиденциальности</Text>
          </Pressable>
          <Pressable
            onPress={onOpenCookies}
            accessibilityRole="link"
            accessibilityLabel="Настройки cookies"
            hitSlop={8}
            style={({ pressed }) => [styles.textLink, pressed && styles.textLinkPressed, globalFocusStyles.focusable]}
          >
            <Text style={styles.textLinkLabel}>Настройки cookies</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </View>
  );
};
