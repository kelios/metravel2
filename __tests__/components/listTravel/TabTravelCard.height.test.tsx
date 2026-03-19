import { render } from '@testing-library/react-native';
import TabTravelCard from '@/components/listTravel/TabTravelCard';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
  }),
}));

const mockUnifiedTravelCard = jest.fn((props: any) => {
  const React = require('react');
  const { View } = require('react-native');

  return (
    <View testID={props.testID || 'unified-travel-card'}>
      {props.contentSlot}
    </View>
  );
});

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}));

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

  it('enables shared web blur background on card media', () => {
    render(
      <TabTravelCard item={baseItem as any} onPress={() => undefined} testID="tab-card" />
    );

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0];
    expect(props?.mediaProps?.allowCriticalWebBlur).toBe(true);
    expect(props?.mediaProps?.blurBackground).toBe(true);
  });
});
