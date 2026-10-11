import { Text, View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export default function SliderCaption({ caption }: { caption?: string }) {
  const colors = useThemedColors();
  const text = caption?.trim();
  if (!text) return null;

  return (
    <View style={styles.container} testID="slider-caption">
      <Text style={[styles.text, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  text: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: 22,
    textAlign: 'center',
  },
});
