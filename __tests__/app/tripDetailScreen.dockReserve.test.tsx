import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';

const SAFE_AREA_BOTTOM = 24;
let mockRootBottomOverlap = 0;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '42' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: SAFE_AREA_BOTTOM, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ background: 'white' }),
}));

jest.mock('@/hooks/useSoftKeyboardInset', () => ({
  useSoftKeyboardInset: () => ({
    contentViewportInset: 0,
    rootBottomOverlap: mockRootBottomOverlap,
  }),
}));

jest.mock('@/components/trips/PublicTripDetail', () => {
  return function PublicTripDetail() {
    const { Text } = require('react-native');
    return <Text testID="trip-detail-stub">trip</Text>;
  };
});

describe('TripDetailScreen (native) bottom dock reserve', () => {
  // BottomDock на native — absolute-оверлей поверх контента, поэтому без резерва
  // кнопка «Отправить заявку» формы «Хочу поехать» уходила под док (#1061).
  it('reserves tab bar height plus safe area at the bottom of the scroll content', () => {
    const TripDetailScreen = require('@/app/(tabs)/trips/[id].native').default;
    const { getByTestId } = render(<TripDetailScreen />);

    const reserve = getByTestId('trip-detail-bottom-reserve');
    const reserveStyle = StyleSheet.flatten(reserve.props.style);

    expect(reserveStyle.height).toBe(
      LAYOUT.tabBarHeight + SAFE_AREA_BOTTOM + DESIGN_TOKENS.spacing.xl,
    );
    expect(reserveStyle.height).toBeGreaterThan(LAYOUT.tabBarHeight + SAFE_AREA_BOTTOM);
  });

  it('uses the real IME overlap as the reachable footer while the keyboard is open', () => {
    mockRootBottomOverlap = 320;

    const TripDetailScreen = require('@/app/(tabs)/trips/[id].native').default;
    const { getByTestId } = render(<TripDetailScreen />);

    const reserveStyle = StyleSheet.flatten(getByTestId('trip-detail-bottom-reserve').props.style);
    expect(reserveStyle.height).toBe(320 + DESIGN_TOKENS.spacing.xl);

    mockRootBottomOverlap = 0;
  });
});
