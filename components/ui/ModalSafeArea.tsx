import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';
import { useThemedColors } from '@/hooks/useTheme';

export type ModalSafeAreaEdge = 'top' | 'bottom' | 'left' | 'right';

const ALL_EDGES: readonly ModalSafeAreaEdge[] = ['top', 'bottom', 'left', 'right'];

type ModalSafeAreaProps = {
  children?: React.ReactNode;
  edges?: readonly ModalSafeAreaEdge[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Безопасная зона для содержимого полноэкранного `Modal` (#2120, MODAL-TOP-INSET-001).
 *
 * Нативный `SafeAreaView` внутри `Modal` на iOS ищет провайдер по цепочке
 * `superview`, а модальное окно живёт в отдельной иерархии вью: провайдера там
 * нет, и отступ снимается с самого вью в момент появления, пока окно ещё
 * выезжает снизу, — верх остаётся нулевым, шапка ложится под статус-бар.
 * Значения корневого контекста (`useSafeAreaInsetsSafe`) проходят через портал
 * `Modal` как обычный React-контекст и равны отступам окна, поэтому применяются
 * обычным `View`. На web значения те же, что отдавал `SafeAreaView` (без выреза —
 * нули). Фон окна — `colors.background` темы:
 * собственного фона у нативного `Modal` нет, и без него тёмная тема светит белым.
 */
export default function ModalSafeArea({ children, edges = ALL_EDGES, style, testID }: ModalSafeAreaProps) {
  const insets = useSafeAreaInsetsSafe();
  const colors = useThemedColors();
  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.background }, style, padding]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
