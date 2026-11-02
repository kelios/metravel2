import { Platform, Text, View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { formatInteger, formatNumber } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';

// #2904: markers for the travel first-screen stylesheet
// (`components/travel/details/travelFirstScreenLayout.ts`), which makes the
// caption small and muted below 768 px. A CSS media rule, not an `isMobile`
// prop: width is 0 on SSR/hydration, so a JS branch would resize the caption on
// desktop after the first paint.
const part = (name: 'root' | 'counter' | 'position' | 'total' | 'text') =>
  Platform.OS === 'web' ? ({ dataSet: { travelSliderCaptionPart: name } } as object) : null;

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
    <View style={styles.container} testID="slider-caption" {...part('root')}>
      <View style={[styles.counter, { borderRightColor: colors.borderLight }]} {...part('counter')}>
        <Text
          {...part('position')}
          style={[styles.position, { color: colors.text }]}
          accessibilityLabel={t('travel:components.travel.sliderParts.Slide.fotografiya_puteshestviya_value1_iz_value2_821e6a83', {
            value1: formatInteger(currentIndex + 1), value2: formatInteger(total),
          })}
        >
          {formatNumber(currentIndex + 1, { minimumIntegerDigits: 2, useGrouping: false })}
        </Text>
        <Text style={[styles.total, { color: colors.textMuted }]} aria-hidden {...part('total')}>
          {t('shared:components.ui.PaginationComponent.iz_f4230cda', { value1: formatInteger(total) })}
        </Text>
      </View>
      <Text style={[styles.text, { color: colors.text }]} {...part('text')}>{text}</Text>
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
