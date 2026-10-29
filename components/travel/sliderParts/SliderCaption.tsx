import { Platform, Text, View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { formatInteger, formatNumber } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';

type SliderCaptionProps = {
  caption?: string;
  currentIndex: number;
  total: number;
};

export default function SliderCaption({ caption, currentIndex, total }: SliderCaptionProps) {
  const colors = useThemedColors();
  const { t } = useTranslation();
  const text = caption?.trim();
  if (!text) return null;

  return (
    <View style={styles.container} testID="slider-caption">
      <View style={[styles.counter, { borderRightColor: colors.borderLight }]}>
        <Text
          style={[styles.position, { color: colors.text }]}
          accessibilityLabel={t('travel:components.travel.sliderParts.Slide.fotografiya_puteshestviya_value1_iz_value2_821e6a83', {
            value1: formatInteger(currentIndex + 1), value2: formatInteger(total),
          })}
        >
          {formatNumber(currentIndex + 1, { minimumIntegerDigits: 2, useGrouping: false })}
        </Text>
        <Text style={[styles.total, { color: colors.textMuted }]} aria-hidden>
          {t('shared:components.ui.PaginationComponent.iz_f4230cda', { value1: formatInteger(total) })}
        </Text>
      </View>
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.md,
  },
  counter: {
    flexShrink: 0,
    alignItems: 'center',
    paddingRight: DESIGN_TOKENS.spacing.md,
    borderRightWidth: 1,
    gap: DESIGN_TOKENS.spacing.xxs,
  },
  position: {
    fontFamily: Platform.select({ web: 'Georgia, serif', ios: 'Georgia', default: 'serif' }),
    fontStyle: 'normal',
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    lineHeight: 30,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  total: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 18,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontFamily: Platform.select({ web: "'LoraCaption', Georgia, serif", ios: 'Georgia', default: 'serif' }),
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    lineHeight: 30,
    textAlign: 'left',
  },
});
