import { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useChooseCharacterPath } from '@/hooks/useGamification';
import { ProgressionAnimalMedallion } from '@/components/achievements/GamificationIcons';
import type { CharacterPathOption } from '@/api/gamification';

interface Props {
  options: CharacterPathOption[];
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Выбор пути развития персонажа после достижения уровня
 * (Картограф/Разведчик/Фотоохотник). FE-path-choice.
 */
function CharacterPathChoice({ options, testID, style }: Props) {
  const colors = useThemedColors();
  const { mutate, isPending, variables } = useChooseCharacterPath();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Домен теперь несёт ВСЕ ветки (в т.ч. заблокированные с lockedReason) — пикер
  // выбора по-прежнему показывает только выбираемые, поведение UI не меняется.
  const selectable = useMemo(
    () => options.filter((o) => o.canSelect),
    [options],
  );

  if (selectable.length === 0) return null;

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <View style={styles.titleRow}>
        <Feather name="git-branch" size={15} color={colors.primaryDark} />
        <Text style={styles.title}>Выберите путь развития</Text>
      </View>

      <View style={styles.options}>
        {options.map((opt) => {
          const pending = isPending && variables?.pathSlug === opt.slug;
          return (
            <Pressable
              key={opt.slug}
              style={[styles.option, pending && styles.optionPending]}
              disabled={isPending}
              onPress={() => mutate({ pathSlug: opt.slug })}
              accessibilityRole="button"
              accessibilityLabel={`Выбрать путь: ${opt.name}. ${opt.description}`}
            >
              <ProgressionAnimalMedallion slug={opt.slug} size={40} />
              <View style={styles.optionBody}>
                <Text style={styles.optionName}>{opt.name}</Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
              <Feather
                name={pending ? 'loader' : 'chevron-right'}
                size={18}
                color={colors.primaryDark}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      gap: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.primarySoft,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '800',
      color: colors.text,
    },
    options: { gap: DESIGN_TOKENS.spacing.sm },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    optionPending: { opacity: 0.6 },
    optionBody: { flex: 1, minWidth: 0, gap: 2 },
    optionName: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    optionDesc: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 16,
    },
  });

export default memo(CharacterPathChoice);
