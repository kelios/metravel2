import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import ClusterLayer from '@/components/MapPage/Map/ClusterLayer';

type MarkerProps = {
  children?: React.ReactNode;
  eventHandlers?: { click?: (event: any) => void };
  ref?: ((marker: any) => void) | React.Ref<any>;
};

const markerInstances: Array<{ openPopup: jest.Mock }> = [];

const Marker = React.forwardRef<any, MarkerProps>(({ children, eventHandlers }, forwardedRef) => {
  const marker = React.useMemo(() => ({ openPopup: jest.fn() }), []);

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
});
