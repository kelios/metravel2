import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import ClusterLayer from '@/components/MapPage/Map/ClusterLayer';

type MarkerProps = {
  children?: React.ReactNode;
  eventHandlers?: { click?: (event: any) => void };
  ref?: ((marker: any) => void) | React.Ref<any>;
};

type FakeIcon = {
  getAttribute: (key: string) => string | null;
  setAttribute: (key: string, value: string) => void;
};

type FakeMarker = {
  openPopup: jest.Mock;
  _icon: FakeIcon | undefined;
  once: (eventName: string, callback: () => void) => void;
  fireAdd: () => void;
  /** How many `once('add', ...)` subscriptions this marker has accumulated. */
  onceAddCallCount: number;
};

const markerInstances: FakeMarker[] = [];

const createFakeIcon = (): FakeIcon => {
  const attrs: Record<string, string> = {};
  return {
    getAttribute: (key) => (key in attrs ? attrs[key] : null),
    setAttribute: (key, value) => {
      attrs[key] = value;
    },
  };
};

// Controls whether the mocked Leaflet marker already has a DOM `_icon` at the
// moment its `ref` callback fires. Mirrors the real react-leaflet race this
// component works around (#1624): `useImperativeHandle` resolves in React's
// layout phase, which can run BEFORE the passive effect that calls
// `map.addLayer(...)` and actually creates the icon.
let mockIconReadyOnMount = true;

const Marker = React.forwardRef<any, MarkerProps>(({ children, eventHandlers }, forwardedRef) => {
  const marker = React.useMemo<FakeMarker>(() => {
    const icon = createFakeIcon();
    const addListeners: Array<() => void> = [];
    const instance: FakeMarker = {
      openPopup: jest.fn(),
      _icon: mockIconReadyOnMount ? icon : undefined,
      onceAddCallCount: 0,
      once: (eventName, callback) => {
        if (eventName !== 'add') return;
        addListeners.push(callback);
        instance.onceAddCallCount += 1;
      },
      fireAdd: () => {
        instance._icon = icon;
        addListeners.forEach((callback) => callback());
      },
    };
    return instance;
  }, []);

  React.useEffect(() => {
    markerInstances.push(marker);

    if (typeof forwardedRef === 'function') {
      forwardedRef(marker);
    } else if (forwardedRef && 'current' in forwardedRef) {
      (forwardedRef as any).current = marker;
    }

    return () => {
      const index = markerInstances.indexOf(marker);
      if (index >= 0) markerInstances.splice(index, 1);
    };
  }, [forwardedRef, marker]);

  return (
    <Pressable
      testID="cluster-marker"
      onPress={() =>
        eventHandlers?.click?.({
          target: marker,
          originalEvent: { stopPropagation: jest.fn() },
        })
      }
    >
      {children}
    </Pressable>
  );
});

Marker.displayName = 'Marker';

describe('ClusterLayer', () => {
  beforeEach(() => {
    markerInstances.length = 0;
    mockIconReadyOnMount = true;
  });

  it('opens singleton cluster popup before marker click follow-up logic', () => {
    const events: string[] = [];
    const onMarkerClick = jest.fn(() => {
      events.push('onMarkerClick');
    });

    const { getByTestId } = render(
      <ClusterLayer
        clusters={[
          {
            key: 'single',
            center: [53.9, 27.56],
            bounds: [
              [53.89, 27.55],
              [53.91, 27.57],
            ],
            count: 1,
            items: [
              {
                id: 'p1',
                coord: '53.9,27.56',
                address: 'Минск',
                categoryName: 'Города',
              },
            ],
          } as any,
        ]}
        Marker={Marker as any}
        Popup={({ children }: any) => <>{children}</>}
        PopupContent={({ point }) => <Text>{point.address}</Text>}
        onMarkerClick={(point, coords) => {
          const popupMarker = markerInstances[0];
          if (popupMarker?.openPopup.mock.calls.length) {
            events.push('openPopup');
          }
          onMarkerClick(point, coords);
        }}
        onMarkerInstance={jest.fn()}
        onClusterZoom={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('cluster-marker'));

    expect(events).toEqual(['openPopup', 'onMarkerClick']);
    expect(onMarkerClick).toHaveBeenCalledTimes(1);
  });

  // #1624 — a bare Leaflet `<div role="button">` cluster icon never gets an
  // accessible name for free (browsers only copy `alt` onto `<img>` icons), so
  // this component sets `aria-label` explicitly via the marker `ref`.
  describe('cluster accessible names (#1624)', () => {
    const multiPointCluster = {
      key: 'group-a',
      center: [53.9, 27.56],
      bounds: [
        [53.89, 27.55],
        [53.91, 27.57],
      ],
      count: 4,
      items: [
        { id: 'p1', coord: '53.90,27.56', address: 'A' },
        { id: 'p2', coord: '53.91,27.57', address: 'B' },
        { id: 'p3', coord: '53.92,27.58', address: 'C' },
        { id: 'p4', coord: '53.93,27.59', address: 'D' },
      ],
    } as any;

    it('sets a localized, pluralized aria-label on a multi-point cluster icon', () => {
      render(
        <ClusterLayer
          clusters={[multiPointCluster]}
          Marker={Marker as any}
          Popup={({ children }: any) => <>{children}</>}
          PopupContent={() => null}
          onMarkerInstance={jest.fn()}
          onClusterZoom={jest.fn()}
        />
      );

      expect(markerInstances).toHaveLength(1);
      expect(markerInstances[0]._icon?.getAttribute('aria-label')).toBe('Кластер: 4 места');
    });

    it('labels the icon once Leaflet fires "add", even when the ref resolved before the icon existed', () => {
      mockIconReadyOnMount = false;

      render(
        <ClusterLayer
          clusters={[multiPointCluster]}
          Marker={Marker as any}
          Popup={({ children }: any) => <>{children}</>}
          PopupContent={() => null}
          onMarkerInstance={jest.fn()}
          onClusterZoom={jest.fn()}
        />
      );

      const marker = markerInstances[0];
      // Ref resolved before the icon existed — nothing to label yet.
      expect(marker._icon).toBeUndefined();

      marker.fireAdd();

      expect(marker._icon?.getAttribute('aria-label')).toBe('Кластер: 4 места');
    });

    it('does not accumulate `once("add", ...)` subscriptions once the icon is ready, even though `ref` re-invokes on every re-render', () => {
      mockIconReadyOnMount = false;

      const renderCard = () => (
        <ClusterLayer
          clusters={[multiPointCluster]}
          Marker={Marker as any}
          Popup={({ children }: any) => <>{children}</>}
          PopupContent={() => null}
          onMarkerInstance={jest.fn()}
          onClusterZoom={jest.fn()}
        />
      );

      const { rerender } = render(renderCard());

      const marker = markerInstances[0];
      expect(marker.onceAddCallCount).toBe(1);

      // Icon becomes ready — the deferred listener fires and labels it.
      marker.fireAdd();
      expect(marker._icon?.getAttribute('aria-label')).toBe('Кластер: 4 места');

      // `ref` on the cluster Marker is an inline arrow (`ref={(marker) =>
      // applyAccessibleName(marker, clusterAccessibleName)}`), so React
      // re-invokes it — with the SAME marker instance, since the cluster key
      // did not change — on every re-render. Re-rendering several times with
      // the icon already ready must not grow the subscription count; the old
      // code subscribed unconditionally and leaked one dead listener per
      // re-render (code review, #1624).
      for (let i = 0; i < 4; i += 1) {
        rerender(renderCard());
      }

      expect(markerInstances).toHaveLength(1);
      expect(marker.onceAddCallCount).toBe(1);
    });

    it('sets an address-based aria-label on a lone single-point cluster', () => {
      render(
        <ClusterLayer
          clusters={[
            {
              key: 'lone',
              center: [53.9, 27.56],
              bounds: [
                [53.89, 27.55],
                [53.91, 27.57],
              ],
              count: 1,
              items: [{ id: 'p1', coord: '53.9,27.56', address: 'Гродно' }],
            } as any,
          ]}
          Marker={Marker as any}
          Popup={({ children }: any) => <>{children}</>}
          PopupContent={() => null}
          onMarkerInstance={jest.fn()}
          onClusterZoom={jest.fn()}
        />
      );

      expect(markerInstances).toHaveLength(1);
      expect(markerInstances[0]._icon?.getAttribute('aria-label')).toBe('Гродно');
    });

    it('sets an address-based aria-label on a single-point marker inside an expanded cluster', () => {
      render(
        <ClusterLayer
          clusters={[multiPointCluster]}
          expandedClusterKey="group-a"
          Marker={Marker as any}
          Popup={({ children }: any) => <>{children}</>}
          PopupContent={() => null}
          onMarkerInstance={jest.fn()}
          onClusterZoom={jest.fn()}
        />
      );

      expect(markerInstances.length).toBeGreaterThan(0);
      const labels = markerInstances.map((marker) => marker._icon?.getAttribute('aria-label'));
      expect(labels).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D']));
    });
  });
});
