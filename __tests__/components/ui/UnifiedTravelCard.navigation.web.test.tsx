/**
 * @jest-environment jsdom
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { Platform, View } from 'react-native';

import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: () => null,
}));

describe('UnifiedTravelCard web navigation ownership', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('keeps its own focusable link overlay for standalone web consumers', () => {
    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <UnifiedTravelCard title="Standalone route" onPress={() => {}} />,
      );
    });

    expect(
      tree!.root.findAll(
        (node: any) => node.props?.role === 'link' && node.props?.tabIndex === 0,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('leaves primary semantics and activation to an external anchor', () => {
    const onCardPress = jest.fn();
    const onActionPress = jest.fn();
    let tree: renderer.ReactTestRenderer;

    renderer.act(() => {
      tree = renderer.create(
        <a
          href="/travels/semantic-route?returnTo=%2Ftravelsby"
          aria-label="Путешествие: Semantic route"
        >
          <UnifiedTravelCard
            title="Semantic route"
            onPress={onCardPress}
            testID="travel-card-semantic-route"
            webNavigationOwner="external"
            rightTopSlot={(
              <View role="button" tabIndex={0} onClick={onActionPress as any}>
                Action
              </View>
            )}
          />
        </a>,
      );
    });

    const anchor = tree!.root.findByType('a');
    expect(anchor.props.href).toBe(
      '/travels/semantic-route?returnTo=%2Ftravelsby',
    );
    expect(
      anchor.findAll(
        (node: any) => node.props?.role === 'link' && node.props?.tabIndex === 0,
      ),
    ).toHaveLength(0);

    const card = tree!.root.findByProps({ testID: 'travel-card-semantic-route' });
    expect(card.props.onClick).toBeUndefined();
    expect(card.props.onKeyDown).toBeUndefined();

    const action = tree!.root.find(
      (node: any) => node.props?.role === 'button' && node.props?.tabIndex === 0,
    );
    renderer.act(() => action.props.onClick());
    expect(onActionPress).toHaveBeenCalledTimes(1);
    expect(onCardPress).not.toHaveBeenCalled();
  });
});
