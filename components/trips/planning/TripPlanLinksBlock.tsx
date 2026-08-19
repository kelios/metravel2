// components/trips/planning/TripPlanLinksBlock.tsx
// #1494: ссылки из описания поездки, собранные в один блок под текстом. В потоке
// описания ссылка теряется, а в дороге по ней нужно попасть быстро — поэтому
// каждый URL дублируется чипом с доменом. Разбор и контракт открытия ссылок —
// общие с `TripPlanLinkedText`, чтобы web получал настоящий `<a href>`.
import React, { useMemo } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import {
  buildTripPlanLinkProps,
  extractTripPlanLinks,
  type TripPlanLinkElementProps,
} from '@/components/trips/planning/TripPlanLinkedText';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';

const LinkText = Text as React.ComponentType<TripPlanLinkElementProps>;

interface Props {
  text: string;
  testID?: string;
}

function TripPlanLinksBlock({ text, testID = 'trip-plan-links' }: Props) {
  const colors = useThemedColors();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const links = useMemo(() => extractTripPlanLinks(text), [text]);

  if (!links.length) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.heading}>{t('tripsStatic:plan.links.title')}</Text>
      <View style={styles.chipRow}>
        {links.map((link) => (
          // Рамка-пилюля живёт на View: RNW рендерит `Text` как inline-элемент,
          // и вертикальный padding на нём не дал бы чипу реальной высоты.
          <View key={link.url} style={styles.chip}>
            <LinkText
              style={styles.chipLabel}
              numberOfLines={1}
              testID={`trip-plan-link-${link.domain}`}
              {...buildTripPlanLinkProps(link)}
            >
              <Feather
                name={link.internal ? 'link' : 'external-link'}
                size={12}
                color={colors.primaryDark}
              />
              {`  ${link.domain}`}
            </LinkText>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 6, marginTop: 10 },
    heading: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.surface,
      maxWidth: '100%',
      overflow: 'hidden',
    },
    chipLabel: {
      // 12 + 20 + 12 = 44dp тач-таргета: кликается вся площадь пилюли, не только текст
      paddingVertical: 12,
      paddingHorizontal: 14,
      lineHeight: 20,
      color: colors.primaryDark,
      fontSize: 13,
      fontWeight: '700',
    },
  });

export default React.memo(TripPlanLinksBlock);
