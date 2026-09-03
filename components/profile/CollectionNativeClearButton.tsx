import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Компактная «Очистить» для кабинетных коллекций на native, где «Назад» и
 * заголовок уже рисует глобальный контекст-бар (см.
 * `isCollectionBackAffordanceGlobal`). Полная `ProfileCollectionHeader` там дала
 * бы второй «Назад» на одном экране (#836, #1726); эта кнопка несёт только
 * разрушающее действие. Размер 44 — тач-таргет, а не декоративный.
 */
export default function CollectionNativeClearButton({ onPress, accessibilityLabel, testID }: Props) {
  const colors = useThemedColors();

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.button, { borderColor: colors.danger, backgroundColor: colors.surface }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <Feather name="trash-2" size={16} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  button: {
    width: DESIGN_TOKENS.touchTarget.minWidth,
    height: DESIGN_TOKENS.touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
  },
});
