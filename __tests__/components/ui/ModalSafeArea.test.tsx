/**
 * #2120 / MODAL-TOP-INSET-001: ModalSafeArea применяет отступы корневого
 * контекста обычным View. Мок инсетов проверяет только применение отступа —
 * доказательство исправления даёт замер на симуляторе (рамка окна с y = 62).
 */
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

let mockInsets = { top: 62, bottom: 34, left: 0, right: 0 };
let mockThrow = false;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => {
    if (mockThrow) throw new Error('No safe area provider');
    return mockInsets;
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ background: '#101010' }),
}));

import ModalSafeArea from '@/components/ui/ModalSafeArea';

const styleOf = (node: any) => StyleSheet.flatten(node.props.style);

describe('ModalSafeArea', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
    mockInsets = { top: 62, bottom: 34, left: 0, right: 0 };
    mockThrow = false;
  });

  it('puts the header below the status bar: paddingTop equals the root top inset', () => {
    const { getByTestId } = render(
      <ModalSafeArea testID="modal-safe-area">
        <Text>Готово</Text>
      </ModalSafeArea>,
    );

    const style = styleOf(getByTestId('modal-safe-area'));
    expect(style).toMatchObject({
      flex: 1,
      paddingTop: 62,
      paddingBottom: 34,
      paddingLeft: 0,
      paddingRight: 0,
      backgroundColor: '#101010',
    });
  });

  it('skips the edges that are not requested', () => {
    const { getByTestId } = render(
      <ModalSafeArea testID="modal-safe-area" edges={['bottom', 'left', 'right']} />,
    );

    expect(styleOf(getByTestId('modal-safe-area'))).toMatchObject({ paddingTop: 0, paddingBottom: 34 });
  });

  it('keeps the insets over a caller style padding', () => {
    const { getByTestId } = render(
      <ModalSafeArea testID="modal-safe-area" style={{ paddingTop: 4, backgroundColor: 'red' }} />,
    );

    expect(styleOf(getByTestId('modal-safe-area'))).toMatchObject({ paddingTop: 62, backgroundColor: 'red' });
  });

  it('falls back to zero insets on web without a provider', () => {
    Platform.OS = 'web';
    mockThrow = true;

    const { getByTestId } = render(<ModalSafeArea testID="modal-safe-area" />);

    expect(styleOf(getByTestId('modal-safe-area'))).toMatchObject({
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    });
  });
});
