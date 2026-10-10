import React, { useMemo } from 'react';
import { Link, router, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { SupportedLocale } from '@/i18n/config';
import { getLocaleDisplayName } from '@/i18n/localeLabels';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { webAccessibilityProps } from '@/utils/webProps';
import type { QuestServingProjection } from '@/utils/questLocaleRouting';

type Props = {
  projection: QuestServingProjection | null;
  currentLocale: SupportedLocale;
  onChosen?: () => void;
  onSelectLocale?: (locale: SupportedLocale) => Promise<void>;
  testIDPrefix?: string;
};

/** Real version anchors, from E alone; gameplay availability is not publication. */
export default function QuestVersionLinks({ projection, currentLocale, onChosen, onSelectLocale, testIDPrefix = 'quest-version' }: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => StyleSheet.create({
    root: { gap: DESIGN_TOKENS.spacing.sm, flexDirection: 'row', flexWrap: 'wrap' },
    link: { minHeight: 44, paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm, justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.sm, borderWidth: 1, borderColor: colors.border },
    current: { backgroundColor: colors.primarySoft },
    label: { color: colors.text, fontSize: 14 },
  }), [colors]);
  if (projection?.state !== 'available' || projection.versions.length < 2) return null;
  return (
    <View style={styles.root} accessibilityLabel={t('quests:localeServing.versions')}>
      {projection.versions.map((version) => (
        <Link key={version.locale} href={version.path as Href} asChild>
          <Pressable accessibilityRole="link" onPress={(event) => {
            const mouse = event as unknown as Partial<React.MouseEvent>;
            const nativeMouse = event.nativeEvent as unknown as Partial<MouseEvent>;
            if (Platform.OS === 'web' && (mouse.defaultPrevented || mouse.metaKey || mouse.ctrlKey
              || mouse.altKey || mouse.shiftKey || nativeMouse.metaKey || nativeMouse.ctrlKey
              || nativeMouse.altKey || nativeMouse.shiftKey
              || (mouse.button != null && mouse.button !== 0)
              || (nativeMouse.button != null && nativeMouse.button !== 0))) return;
            if (!onSelectLocale) { onChosen?.(); return; }
            event.preventDefault();
            const navigate = () => {
              onChosen?.();
              router.push(version.path as Href);
            };
            // Storage/catalogue failure cannot disable an otherwise valid URL.
            void onSelectLocale(version.locale).then(navigate, navigate);
          }}
            testID={`${testIDPrefix}-${version.locale}`}
            {...(Platform.OS === 'web' && version.locale === currentLocale
              ? webAccessibilityProps({ 'aria-current': 'page' as const }) : {})}
            style={StyleSheet.flatten([styles.link, version.locale === currentLocale && styles.current])}>
            <Text style={styles.label}>{getLocaleDisplayName(version.locale)}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
