import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useMyAchievements } from '@/hooks/useAchievementsApi';
import { useMyPlaceFirstBadges } from '@/hooks/useGamification';
import Button from '@/components/ui/Button';
import { translate as i18nT } from '@/i18n'


const DISMISS_KEY = '@metravel/gamification2-onboarding-dismissed';

interface Props {
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * First-run объяснение прогрессии/персонажей: показывается один раз новым
 * пользователям без бейджей, с CTA «как получить первый бейдж». После закрытия
 * больше не появляется (флаг в AsyncStorage). FE-gamification2-onboarding.
 */
function GamificationOnboarding({ testID, style }: Props) {
  const colors = useThemedColors();
  const { data: achievements } = useMyAchievements();
  const { data: placeBadges } = useMyPlaceFirstBadges();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(DISMISS_KEY)
      .then((v) => {
        if (active) setDismissed(v === '1');
      })
      .catch(() => {
        if (active) setDismissed(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void AsyncStorage.setItem(DISMISS_KEY, '1').catch(() => undefined);
  }, []);

  const styles = useMemo(() => getStyles(colors), [colors]);

  // Показываем только когда точно знаем состояние, юзер без бейджей и не закрывал.
  const hasBadges =
    (achievements?.earned.length ?? 0) > 0 || (placeBadges?.length ?? 0) > 0;
  if (dismissed !== false || !achievements || hasBadges) return null;

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Feather name="award" size={20} color={colors.textOnPrimary} />
        </View>
        <Text style={styles.title}>{i18nT('achievements:components.achievements.GamificationOnboarding.zarabatyvayte_znachki_i_prokachivayte_tropy_a7e67b84')}</Text>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={i18nT('achievements:components.achievements.GamificationOnboarding.zakryt_podskazku_e28ce368')}
          style={styles.closeButton}
        >
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.body}>
        {i18nT('achievements:components.achievements.GamificationOnboarding.dobavlyayte_novye_mesta_publikuyte_puteshest_b014df26')}</Text>

      <View style={styles.steps}>
        <Step icon="map-pin" text={i18nT('achievements:components.achievements.GamificationOnboarding.dobavte_mesto_stante_ego_pervootkryvatelem_f213a279')} colors={colors} />
        <Step icon="edit-3" text={i18nT('achievements:components.achievements.GamificationOnboarding.opublikuyte_puteshestvie_pervyy_znachok_avto_af385d50')} colors={colors} />
        <Step icon="flag" text={i18nT('achievements:components.achievements.GamificationOnboarding.proydite_kvest_prokachayte_tropu_50d14dcf')} colors={colors} />
      </View>

      <Button
        variant="primary"
        size="sm"
        label={i18nT('achievements:components.achievements.GamificationOnboarding.ponyatno_6f4db72e')}
        onPress={dismiss}
        accessibilityLabel={i18nT('achievements:components.achievements.GamificationOnboarding.ponyatno_kak_poluchit_pervyy_beydzh_122e7a5c')}
        style={styles.cta}
      />
    </View>
  );
}

function Step({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  colors: ReturnType<typeof useThemedColors>;
}) {
  const styles = getStyles(colors);
  return (
    <View style={styles.step}>
      <Feather name={icon} size={15} color={colors.primaryDark} />
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.primarySoft,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    closeButton: {
      width: DESIGN_TOKENS.touchTarget.minWidth,
      height: DESIGN_TOKENS.touchTarget.minHeight,
      borderRadius: DESIGN_TOKENS.touchTarget.minHeight / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '800',
      color: colors.text,
    },
    body: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 18,
    },
    steps: { gap: 6 },
    step: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
    stepText: {
      flex: 1,
      minWidth: 0,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.text,
    },
    cta: {
      alignSelf: 'flex-start',
      marginTop: 2,
    },
  });

export default memo(GamificationOnboarding);
