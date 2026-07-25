import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';

const SAFE_AREA_BOTTOM = 24;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '42' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: SAFE_AREA_BOTTOM, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ background: 'white' }),
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

    const scroll = getByTestId('trip-detail-scroll');
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);

    expect(contentStyle.paddingBottom).toBe(
      LAYOUT.tabBarHeight + SAFE_AREA_BOTTOM + DESIGN_TOKENS.spacing.xl,
    );
    expect(contentStyle.paddingBottom).toBeGreaterThan(LAYOUT.tabBarHeight + SAFE_AREA_BOTTOM);
  });
});
