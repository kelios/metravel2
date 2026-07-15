import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Paragraph } from '@/ui/paper';
import Feather from '@expo/vector-icons/Feather';
import { useAboutStyles } from './aboutStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


type Props = {
  email: string;
  onSendMail: () => void;
  onOpenUrl: (url: string) => void;
  onOpenPrivacy: () => void;
  onOpenCookies: () => void;
  socialLinks: { instagram: string; tiktok: string; youtube: string };
  versionInfo?: {
    appVersion: string;
    displayVersion?: string;
    webBuildVersion?: string;
  };
};

export const AboutIntroCard: React.FC<Props> = ({
  email,
  onSendMail,
  onOpenUrl,
  onOpenPrivacy,
  onOpenCookies,
  socialLinks,
  versionInfo,
}) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
  return (
  <View style={styles.infoCard}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{i18nT('home:components.about.AboutIntroCard.o_proekte_d94d47ff')}</Text>
    </View>
    <Paragraph style={styles.paragraph}>
      {i18nT('home:components.about.AboutIntroCard.metravel_by_eto_nekommercheskiy_proekt_dlya__875e611a')}</Paragraph>

    <View style={styles.sectionDivider} />

    <Text style={styles.sectionTitle}>{i18nT('home:components.about.AboutIntroCard.kak_podelitsya_puteshestviem_02c033d2')}</Text>
    <View style={styles.stepsList} accessibilityRole="list">
      {[i18nT('home:components.about.AboutIntroCard.registriruemsya_32afe09e'), i18nT('home:components.about.AboutIntroCard.dobavlyaem_svoe_puteshestvie_00e90afd'), i18nT('home:components.about.AboutIntroCard.stavim_status_opublikovat_3562dad7'), i18nT('home:components.about.AboutIntroCard.zhdem_moderatsii_do_24_chasov_e79a615e'), i18nT('home:components.about.AboutIntroCard.hotite_v_instagram_napishite_v_direkt_metrav_2250a3fe')].map(
        (text, idx) => (
          <View
            key={text}
            style={styles.stepItem}
            {...(Platform.OS === 'web' ? ({ role: 'listitem' } as any) : {})}
          >
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
        {i18nT('home:components.about.AboutIntroCard.proekt_zapuschen_v_iyune_2020_ispolzovanie_m_39f4469b')}</Text>
      {versionInfo ? (
        <View style={styles.versionInfoBlock} testID="about-app-version">
          <Text style={styles.footerText}>{i18nT('home:components.about.AboutIntroCard.versiya_prilozheniya_01aa3c56')}{versionInfo.displayVersion ?? versionInfo.appVersion}</Text>
          {versionInfo.webBuildVersion ? (
            <Text style={styles.footerText}>{i18nT('home:components.about.AboutIntroCard.web_build_c7a80e75')}{versionInfo.webBuildVersion}</Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.contactLabel}>{i18nT('home:components.about.AboutIntroCard.idei_otzyvy_i_predlozheniya_edfb63c0')}</Text>
      <Pressable
        onPress={onSendMail}
        accessibilityRole="button"
        accessibilityLabel={i18nT('home:components.about.AboutIntroCard.napisat_na_elektronnuyu_pochtu_76b9ee8d')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.emailButton, pressed && styles.emailButtonPressed]}
      >
        <Feather name="mail" size={18} color={colors.primaryDark} />
        <Text style={styles.emailText}>{email}</Text>
      </Pressable>

      <View style={styles.linksBlock}>
        <View style={styles.socialRow}>
          <Pressable
            onPress={() => onOpenUrl(socialLinks.tiktok)}
            accessibilityRole="link"
            accessibilityLabel={i18nT('home:components.about.AboutIntroCard.metravel_v_tiktok_b06b21ca')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconLink,
              pressed && styles.iconLinkPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <Feather name="music" size={18} color={colors.primaryDark} />
          </Pressable>
          <Pressable
            onPress={() => onOpenUrl(socialLinks.instagram)}
            accessibilityRole="link"
            accessibilityLabel={i18nT('home:components.about.AboutIntroCard.metravel_v_instagram_6aa1dba0')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconLink,
              pressed && styles.iconLinkPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <Feather name="instagram" size={18} color={colors.primaryDark} />
          </Pressable>
          <Pressable
            onPress={() => onOpenUrl(socialLinks.youtube)}
            accessibilityRole="link"
            accessibilityLabel={i18nT('home:components.about.AboutIntroCard.metravel_na_youtube_fabb3ad5')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconLink,
              pressed && styles.iconLinkPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <Feather name="youtube" size={18} color={colors.primaryDark} />
          </Pressable>
        </View>

        <View style={styles.utilityLinksRow}>
          <Pressable
            onPress={onOpenPrivacy}
            accessibilityRole="link"
            accessibilityLabel={i18nT('home:components.about.AboutIntroCard.politika_konfidentsialnosti_19e147e0')}
            hitSlop={8}
            style={({ pressed }) => [styles.textLink, pressed && styles.textLinkPressed, globalFocusStyles.focusable]}
          >
            <Text style={styles.textLinkLabel}>{i18nT('home:components.about.AboutIntroCard.politika_konfidentsialnosti_19e147e0')}</Text>
          </Pressable>
          <Pressable
            onPress={onOpenCookies}
            accessibilityRole="link"
            accessibilityLabel={i18nT('home:components.about.AboutIntroCard.nastroyki_cookies_a10130ce')}
            hitSlop={8}
            style={({ pressed }) => [styles.textLink, pressed && styles.textLinkPressed, globalFocusStyles.focusable]}
          >
            <Text style={styles.textLinkLabel}>{i18nT('home:components.about.AboutIntroCard.nastroyki_cookies_a10130ce')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </View>
  );
};
