import React, { useMemo } from 'react';
import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { SupportedLocale } from '@/i18n/config';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Button from '@/components/ui/Button';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import type { QuestServingProjection } from '@/utils/questLocaleRouting';

type Props = { projection: QuestServingProjection | null; locale: SupportedLocale;
  temporary: boolean; onRetry: () => void };

export default function QuestLocaleUnavailable({ projection, temporary, onRetry }: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => StyleSheet.create({
    root: { padding: DESIGN_TOKENS.spacing.lg, gap: DESIGN_TOKENS.spacing.md, maxWidth: 720 },
    title: { color: colors.text, fontSize: 24, fontWeight: '700' },
    text: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
    link: { minHeight: 44, justifyContent: 'center', paddingVertical: DESIGN_TOKENS.spacing.sm },
    linkText: { color: colors.primary, fontSize: 16 },
  }), [colors]);
  return (
    <View style={styles.root}>
      <InstantSEO headKey="quest-locale-unavailable" robots="noindex, follow"
        title={temporary ? t('quests:localeServing.temporaryTitle') : t('quests:localeServing.unavailableTitle')}
        description={temporary ? t('quests:localeServing.temporaryDescription') : t('quests:localeServing.unavailableDescription')} />
      <Text accessibilityRole="header" style={styles.title}>
        {temporary ? t('quests:localeServing.temporaryTitle') : t('quests:localeServing.unavailableTitle')}
      </Text>
      <Text style={styles.text}>
        {temporary ? t('quests:localeServing.temporaryDescription') : t('quests:localeServing.unavailableDescription')}
      </Text>
      <Button label={t('quests:localeServing.retry')} onPress={onRetry} />
      {projection?.ru_source_path && (
        <Link href={projection.ru_source_path as Href} asChild>
          <Pressable accessibilityRole="link" style={styles.link}>
            <Text style={styles.linkText}>{t('quests:localeServing.ruSource')}</Text>
          </Pressable>
        </Link>
      )}
      {!projection?.ru_source_path && (
        <Link href="/quests" asChild>
          <Pressable accessibilityRole="link" style={styles.link}>
            <Text style={styles.linkText}>{t('quests:app.tabs.quests.city.questId.k_spisku_kvestov_27c3b0f7')}</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}
