const React = require('react');
const { render } = require('@testing-library/react-native');

const MapMarkers = require('@/components/MapPage/Map/MapMarkers').default;

describe('MapMarkers', () => {
  it('renders a Marker for each valid point coord', () => {
    const RN = require('react-native');
    const View = RN.View;

    const Marker = (props: any) => <View testID="marker" {...props} />;
    const Popup = ({ children }: any) => <View testID="popup">{children}</View>;
    const PopupContent = ({ point }: any) => <View testID="popup-content" data-address={point?.address} />;

    const points = [
      { id: 1, coord: '50.0619474,19.9368564', address: 'A', travelImageThumbUrl: '', categoryName: '' },
      { id: 2, coord: '50.0620000,19.9369000', address: 'B', travelImageThumbUrl: '', categoryName: '' },
      // invalid
      { id: 3, coord: 'not-a-coord', address: 'C', travelImageThumbUrl: '', categoryName: '' },
      // invalid range
      { id: 4, coord: '500,500', address: 'D', travelImageThumbUrl: '', categoryName: '' },
    ];

    const { queryAllByTestId } = render(
      <MapMarkers
        points={points}
        icon={{}}
        Marker={Marker}
        Popup={Popup}
        PopupContent={PopupContent}
      />
    );

    expect(queryAllByTestId('marker').length).toBe(2);
  });

  it('lets follow-up map behavior open the popup when marker click is handled', () => {
    const RN = require('react-native');
    const View = RN.View;

    let markerProps: any = null;
    const markerOpenPopup = jest.fn();
    const onMarkerClick = jest.fn(() => {
      expect(markerOpenPopup).not.toHaveBeenCalled();
    });

    const Marker = (props: any) => {
      markerProps = props;
      return <View testID="marker" {...props} />;
    };
    const Popup = ({ children }: any) => <View testID="popup">{children}</View>;
    const PopupContent = ({ point }: any) => <View testID="popup-content" data-address={point?.address} />;

    render(
      <MapMarkers
        points={[
          { id: 1, coord: '50.0619474,19.9368564', address: 'A', travelImageThumbUrl: '', categoryName: '' },
        ]}
        icon={{}}
        Marker={Marker}
        Popup={Popup}
        PopupContent={PopupContent}
        onMarkerClick={onMarkerClick}
      />
    );

    expect(typeof markerProps?.eventHandlers?.click).toBe('function');

    markerProps.eventHandlers.click({
      originalEvent: { stopPropagation: jest.fn() },
      target: {
        openPopup: markerOpenPopup,
      },
    });

    expect(markerOpenPopup).not.toHaveBeenCalled();
    expect(onMarkerClick).toHaveBeenCalledTimes(1);
    expect(onMarkerClick.mock.calls[0][2]).toEqual({
      openPopup: markerOpenPopup,
    });
  });
});
