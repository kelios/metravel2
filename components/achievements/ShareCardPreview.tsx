// components/achievements/ShareCardPreview.tsx
// Превью share-карточки достижения (Sprint 12, #384/#385). Показывает, как выглядит
// карточка, которой делится пользователь: медаль + название + причина + ник + дата +
// бренд MeTravel + CTA. Две вариации: default (обычные медали) и rare (премиум-визуал
// редких наград — #385): золотая рамка, лента «Редкая награда», тёплый градиент.
// Server-side картинку рисует BE (#382); этот компонент — FE-превью и эталон верстки.

import { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { Badge } from '@/api/achievements';
import BadgeMedal from '@/components/achievements/BadgeMedal';
import { TIER_VISUALS } from '@/components/achievements/badgeVisuals';
import { translate as i18nT } from '@/i18n'


export interface ShareCardSubject {
  badge: Badge;
  /** Подпись владельца (ник). */
  ownerName?: string;
  /** Причина/описание награды. */
  reason?: string;
  dateLabel?: string;
  isRare: boolean;
}

interface Props {
  subject: ShareCardSubject;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function ShareCardPreview({ subject, testID, style }: Props) {
  const colors = useThemedColors();
  const tier = TIER_VISUALS[subject.badge.tier];
  const styles = useMemo(() => getStyles(colors), [colors]);

  const Frame = subject.isRare ? PremiumFrame : RegularFrame;

  return (
    <Frame tierRing={tier.ring} colors={colors} style={style} testID={testID}>
      {subject.isRare ? (
        <View style={[styles.ribbon, { backgroundColor: tier.ring }]}>
          <Feather name="star" size={11} color="#1A1A1A" />
          <Text style={styles.ribbonText}>{i18nT('achievements:components.achievements.ShareCardPreview.redkaya_nagrada_847c785d')}</Text>
        </View>
      ) : null}

      <BadgeMedal badge={subject.badge} size={92} earned />

      <Text
        style={[styles.title, subject.isRare && { color: tier.ring }]}
        numberOfLines={2}
      >
        {subject.badge.name}
      </Text>

      {subject.reason ? (
        <Text style={styles.reason} numberOfLines={3}>
          {subject.reason}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {subject.ownerName ? (
          <Text style={styles.meta} numberOfLines={1}>
            @{subject.ownerName}
          </Text>
        ) : null}
        {subject.ownerName && subject.dateLabel ? (
          <Text style={styles.metaDot}>·</Text>
        ) : null}
        {subject.dateLabel ? (
          <Text style={styles.meta}>{subject.dateLabel}</Text>
        ) : null}
      </View>

      <View style={styles.brandRow}>
        <Feather name="map-pin" size={12} color={colors.primaryDark} />
        <Text style={styles.brand}>{i18nT('achievements:components.achievements.ShareCardPreview.metravel_by_8afe6b7c')}</Text>
        <Text style={styles.cta}>{i18nT('achievements:components.achievements.ShareCardPreview.soberi_svoyu_kollektsiyu_61067247')}</Text>
      </View>
    </Frame>
  );
}

interface FrameProps {
  tierRing: string;
  colors: ReturnType<typeof useThemedColors>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}

function RegularFrame({ colors, style, testID, children }: FrameProps) {
  const styles = getStyles(colors);
  return (
    <View style={[styles.card, styles.cardRegular, style]} testID={testID}>
      {children}
    </View>
  );
}

function PremiumFrame({ tierRing, colors, style, testID, children }: FrameProps) {
  const styles = getStyles(colors);
  return (
    <LinearGradient
      colors={[`${tierRing}33`, colors.surface, `${tierRing}22`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, styles.cardPremium, { borderColor: tierRing }, style]}
      testID={testID}
    >
      {children}
    </LinearGradient>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.lg,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.xl,
      overflow: 'hidden',
    },
    cardRegular: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cardPremium: {
      borderWidth: 2,
    },
    ribbon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      marginBottom: 2,
    },
    ribbonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '800',
      color: '#1A1A1A',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    reason: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    meta: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: '700',
    },
    metaDot: { color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.xs },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    brand: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '800',
      color: colors.primaryText,
    },
    cta: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
  });

export default memo(ShareCardPreview);
