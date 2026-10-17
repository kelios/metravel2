/**
 * #2453 — diff по стабильному ключу для каналов маркеров/кластеров native-карты.
 */
import {
  diffNativeKeyedItems,
  isEmptyNativePatch,
  nativeClusterKey,
  nativeClusterSignature,
  nativeMarkerKey,
  nativeMarkerSignature,
} from '@/components/MapPage/Map/nativeMarkerDiff';
import type {
  NativeClusterPayloadItem,
  NativeMarkerPayloadItem,
} from '@/components/MapPage/Map/nativeMarkerPayload';

const marker = (key: string, coord: string, extra: Partial<NativeMarkerPayloadItem> = {}): NativeMarkerPayloadItem => ({
  placeKey: key,
  id: key,
  coord,
  categoryName: 'Attraction',
  sourceCount: 1,
  ...extra,
});

const diffMarkers = (sent: Map<string, string>, next: NativeMarkerPayloadItem[]) =>
  diffNativeKeyedItems(sent, next, nativeMarkerKey, nativeMarkerSignature);

describe('diffNativeKeyedItems — markers', () => {
  const base = [marker('p-1', '53.9,27.5'), marker('p-2', '53.8,27.6')];

  it('the same set again yields an empty patch', () => {
    const first = diffMarkers(new Map(), base);
    expect(first.patch.add).toHaveLength(2);
    const again = diffMarkers(first.nextSent, base.map((item) => ({ ...item })));
    expect(again.patch).toEqual({ add: [], removeKeys: [] });
    expect(isEmptyNativePatch(again.patch)).toBe(true);
  });

  it('one new point yields exactly one add', () => {
    const { nextSent } = diffMarkers(new Map(), base);
    const extra = marker('p-3', '53.7,27.7');
    const { patch } = diffMarkers(nextSent, [...base, extra]);
    expect(patch.add).toEqual([extra]);
    expect(patch.removeKeys).toEqual([]);
  });

  it('a removed point yields its key and a changed point is re-added under the same key', () => {
    const { nextSent } = diffMarkers(new Map(), base);
    const moved = marker('p-1', '53.95,27.55');
    const { patch } = diffMarkers(nextSent, [moved]);
    expect(patch.add).toEqual([moved]);
    expect(patch.removeKeys).toEqual(['p-2']);
  });

  it('skips points without coordinates and keys coord-only places by coordinate', () => {
    const { patch } = diffMarkers(new Map(), [
      marker('', '53.1,27.1'),
      marker('p-9', ''),
    ]);
    expect(patch.add).toHaveLength(1);
    expect(nativeMarkerKey(patch.add[0])).toBe('c:53.1,27.1');
  });
});

describe('diffNativeKeyedItems — clusters', () => {
  const cluster = (key: string): NativeClusterPayloadItem => ({
    key,
    center: [53.95, 27.6],
    count: 12,
    bounds: [[53.8, 27.4], [54.1, 27.8]],
  });

  it('keeps an unchanged geometric key out of the patch', () => {
    const first = diffNativeKeyedItems(new Map(), [cluster('a'), cluster('b')], nativeClusterKey, nativeClusterSignature);
    const next = diffNativeKeyedItems(first.nextSent, [cluster('b'), cluster('c')], nativeClusterKey, nativeClusterSignature);
    expect(next.patch.add.map((item) => item.key)).toEqual(['c']);
    expect(next.patch.removeKeys).toEqual(['a']);
  });
});
