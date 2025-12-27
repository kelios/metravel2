import { render } from '@testing-library/react-native';
import TabTravelCard from '@/components/listTravel/TabTravelCard';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
  }),
}));

jest.mock('@/components/ui/UnifiedTravelCard', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockUnifiedTravelCard(props: any) {
    return (
      <View testID={props.testID || 'unified-travel-card'}>
        {props.contentSlot}
      </View>
    );
  };
});

describe('TabTravelCard content height rules', () => {
  const baseItem = {
    id: '1',
    title: 'Test title',
    imageUrl: null,
    city: null,
    country: 'Poland',
  };

  it('uses a stable default content minHeight', () => {
    const { getByTestId } = render(
      <TabTravelCard item={baseItem as any} onPress={() => undefined} testID="tab-card" />
    );

    const content = getByTestId('tab-card-content');
    const style = Array.isArray(content.props.style) ? Object.assign({}, ...content.props.style.filter(Boolean)) : content.props.style;

    expect(style.minHeight).toBe(64);
  });

  it('allows overriding content minHeight via prop for compact/expanded blocks', () => {
    const { getByTestId } = render(
      <TabTravelCard
        item={baseItem as any}
        onPress={() => undefined}
        testID="tab-card"
        contentMinHeight={48}
      />
    );

    const content = getByTestId('tab-card-content');
    const style = Array.isArray(content.props.style) ? Object.assign({}, ...content.props.style.filter(Boolean)) : content.props.style;

    expect(style.minHeight).toBe(48);
  });
});
