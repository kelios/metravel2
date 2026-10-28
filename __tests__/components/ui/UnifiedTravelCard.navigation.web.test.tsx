/**
 * @jest-environment jsdom
 */

import React, { act } from 'react';
import * as renderer from 'test-renderer';
import { Platform, View } from 'react-native';

import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
const roots = new Set<renderer.Root>()
afterEach(async () => {
  for (const root of roots) await act(() => root.unmount())
  roots.clear()
})


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

  it('keeps its own focusable link overlay for standalone web consumers', async () => {
    let tree: renderer.Root;
    await act(() => {
      tree = renderer.createRoot();
      roots.add(tree)
      tree.render(<UnifiedTravelCard title="Standalone route" onPress={() => {}} />)
    });

    expect(
      tree!.container.queryAll(
        (node: any) => node.props?.role === 'link' && node.props?.tabIndex === 0,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('leaves primary semantics and activation to an external anchor', async () => {
    const onCardPress = jest.fn();
    const onActionPress = jest.fn();
    let tree: renderer.Root;

    await act(() => {
      tree = renderer.createRoot();
      roots.add(tree)
      tree.render(<a
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
        </a>)
    });

    const anchorMatches = tree!.container.queryAll(node => node.type === 'a')
    expect(anchorMatches).toHaveLength(1)
    const [anchor] = anchorMatches
    expect(anchor.props.href).toBe(
      '/travels/semantic-route?returnTo=%2Ftravelsby',
    );
    expect(
      anchor.queryAll(
        (node: any) => node.props?.role === 'link' && node.props?.tabIndex === 0,
      ),
    ).toHaveLength(0);

    const cardMatches = tree!.container.queryAll(node => Object.entries({ testID: 'travel-card-semantic-route' }).every(([key, value]) => node.props[key] === value))
    expect(cardMatches).toHaveLength(1)
    const [card] = cardMatches
    expect(card.props.onClick).toBeUndefined();
    expect(card.props.onKeyDown).toBeUndefined();

    const actionMatches = tree!.container.queryAll((node: any) => node.props?.role === 'button' && node.props?.tabIndex === 0)
    expect(actionMatches).toHaveLength(1)
    const [action] = actionMatches
    await act(() => action.props.onClick());
    expect(onActionPress).toHaveBeenCalledTimes(1);
    expect(onCardPress).not.toHaveBeenCalled();
  });
});
