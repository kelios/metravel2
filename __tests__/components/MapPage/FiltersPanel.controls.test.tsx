/**
 * @jest-environment jsdom
 */
import { render, fireEvent } from '@testing-library/react-native';
import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { FiltersProvider } from '@/context/MapFiltersContext';
import type { MapUiApi } from '@/src/types/mapUi';
import { makeFiltersContext } from '@/__tests__/utils/makeFiltersContext';

// All mocks must be at the top
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#5d8c7c',
    primaryDark: '#4a7a6a',
    primaryLight: '#8fb5a5',
    primarySoft: '#e8f5e9',
    text: '#1a1a1a',
    textMuted: '#666666',
    textOnPrimary: '#ffffff',
    textOnDark: '#ffffff',
    surface: '#ffffff',
    surfaceSecondary: '#f5f5f5',
    surfaceMuted: '#f5f5f5',
    surfaceLight: '#fafafa',
    mutedBackground: '#f5f5f5',
    backgroundSecondary: '#f5f5f5',
    border: '#e0e0e0',
    borderLight: '#f0f0f0',
    success: '#4caf50',
    danger: '#f44336',
    dangerLight: '#ffebee',
    dangerDark: '#c62828',
    warning: '#ff9800',
    warningLight: '#fff3e0',
    warningDark: '#ef6c00',
    info: '#2196f3',
    infoLight: '#e3f2fd',
    infoDark: '#1565c0',
    overlay: 'rgba(0,0,0,0.6)',
    overlayLight: 'rgba(0,0,0,0.1)',
    background: '#ffffff',
    focusRing: '#5d8c7c',
    shadows: {
      light: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
    },
  }),
  globalFocusStyles: {
    focusable: {},
    focused: {},
  },
}));

jest.mock('@/components/MapPage/RoutingStatus', () => {
  const { View, Text } = require('react-native');
  return function MockRoutingStatus() {
    return <View testID="routing-status"><Text>Status</Text></View>;
  };
});

jest.mock('@/components/MapPage/AddressSearch', () => {
  const { TextInput } = require('react-native');
  return function MockAddressSearch({ placeholder, value }: any) {
    return <TextInput testID={`address-search-${placeholder}`} placeholder={placeholder} value={value} />;
  };
});

jest.mock('@/components/MapPage/RouteBuilder', () => {
  const { View, Text } = require('react-native');
  return function MockRouteBuilder({ startAddress, endAddress, routePoints = [], onRemoveRoutePoint }: any) {
    return (
      <View testID="route-builder">
        <Text>Start: {startAddress}</Text>
        <Text>End: {endAddress}</Text>
        <View testID="route-points-list">
          {routePoints.map((p: any) => (
            <View key={p.id}>
              <Text>{p.address}</Text>
              <Text testID={`route-point-remove-${p.id}`} onPress={() => onRemoveRoutePoint?.(p.id)}>
                X
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
});

jest.mock('@/components/MapPage/MapLegend', () => {
  const { View } = require('react-native');
  return function MockMapLegend() {
    return <View testID="map-legend" />;
  };
});

jest.mock('@/components/MapPage/ValidationMessage', () => {
  const { View } = require('react-native');
  return function MockValidationMessage() {
    return <View testID="validation-message" />;
  };
});

jest.mock('@/components/filters/CategoryChips', () => {
  const { View } = require('react-native');
  return function MockCategoryChips() {
    return <View testID="category-chips" />;
  };
});

jest.mock('@/components/ui/CollapsibleBlock', () => {
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');
  return function MockCollapsibleSection({ title, children, defaultOpen = true }: any) {
    const [open, setOpen] = React.useState(defaultOpen);
    return (
      <View testID={`collapsible-${title}`}>
        <Pressable onPress={() => setOpen(!open)} testID={`collapsible-toggle-${title}`}>
          <Text>{title}</Text>
        </Pressable>
        {open && children}
      </View>
    );
  };
});

jest.mock('@/components/MapPage/SegmentedControl', () => {
  const { View, Pressable, Text } = require('react-native');
  return function MockSegmentedControl({ options, value: _value, onChange }: any) {
    return (
      <View testID="segmented-control">
        {options.map((opt: any) => (
          <Pressable key={opt.key} testID={`segmented-${opt.key}`} onPress={() => onChange(opt.key)}>
            <Text>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
});

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

describe('FiltersPanel Controls', () => {
  const mockFilters = {
    categories: [{ name: 'Природа', count: 10 }],
    radius: [{ id: '60', name: '60 км' }, { id: '100', name: '100 км' }, { id: '200', name: '200 км' }],
    address: '',
  };

  const mockFilterValue = {
    categories: [],
    radius: '60',
    address: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Route point pills', () => {
    it('renders route points as pills and calls onRemoveRoutePoint when X is pressed', () => {
      const onRemoveRoutePoint = jest.fn();

      const context = makeFiltersContext({
        filters: mockFilters,
        filterValue: mockFilterValue,
        mode: 'route',
        onRemoveRoutePoint,
        onAddressSelect: undefined as any,
        onAddressClear: undefined as any,
        routePoints: [
          { id: 'p1', coordinates: { lat: 50.0, lng: 19.9 }, address: 'Kraków', type: 'start', timestamp: Date.now() },
          { id: 'p2', coordinates: { lat: 50.1, lng: 20.0 }, address: 'Rynek Główny', type: 'end', timestamp: Date.now() },
        ],
      });

      const { getByTestId, getByText } = render(
        <FiltersProvider {...context}>
          <FiltersPanel />
        </FiltersProvider>
      );

      expect(getByTestId('route-points-list')).toBeTruthy();
      expect(getByText('Kraków')).toBeTruthy();

      fireEvent.press(getByTestId('route-point-remove-p1'));
      expect(onRemoveRoutePoint).toHaveBeenCalledWith('p1');
    });
  });

  describe('Transport Mode Controls', () => {
    it('should call setTransportMode when transport button clicked and route is ready', () => {
      const setTransportMode = jest.fn();
      const context = makeFiltersContext({
        filters: mockFilters,
        filterValue: mockFilterValue,
        mode: 'route',
        setTransportMode,
        routePoints: [
          { id: '1', coordinates: { lat: 53.9, lng: 27.5 }, address: 'Start', type: 'start', timestamp: Date.now() },
          { id: '2', coordinates: { lat: 54.0, lng: 28.0 }, address: 'End', type: 'end', timestamp: Date.now() },
        ],
        startAddress: 'Start Address',
        endAddress: 'End Address',
      });
      const { getByText } = render(
        <FiltersProvider {...context}>
          <FiltersPanel />
        </FiltersProvider>
      );

      const bikeTabText: any = getByText('Велосипед');
      const bikePressable = bikeTabText.parent;
      fireEvent.press(bikePressable);

      expect(setTransportMode).toHaveBeenCalledWith('bike');
    });

    it('should NOT call setTransportMode when no route points', () => {
      const setTransportMode = jest.fn();
      const context = makeFiltersContext({
        filters: mockFilters,
        filterValue: mockFilterValue,
        mode: 'route',
        setTransportMode,
        routePoints: [],
      });
      const { getByText } = render(
        <FiltersProvider {...context}>
          <FiltersPanel />
        </FiltersProvider>
      );

      const carTabText: any = getByText('Авто');
      const carPressable = carTabText.parent;
      fireEvent.press(carPressable);

      expect(setTransportMode).not.toHaveBeenCalled();
    });
  });

  describe('Mode Switching', () => {
    it('should call setMode when switching to route mode', () => {
      const setMode = jest.fn();
      const context = makeFiltersContext({
        filters: mockFilters,
        filterValue: mockFilterValue,
        mode: 'radius',
        setMode,
      });
      const { getByTestId } = render(
        <FiltersProvider {...context}>
          <FiltersPanel />
        </FiltersProvider>
      );

      const routeTab = getByTestId('segmented-route');
      fireEvent.press(routeTab);

      expect(setMode).toHaveBeenCalledWith('route');
    });

    it('should call setMode when switching to radius mode', () => {
      const setMode = jest.fn();
      const context = makeFiltersContext({
        filters: mockFilters,
        filterValue: mockFilterValue,
        mode: 'route',
        setMode,
      });
      const { getByTestId } = render(
        <FiltersProvider {...context}>
          <FiltersPanel />
        </FiltersProvider>
      );

      const radiusTab = getByTestId('segmented-radius');
      fireEvent.press(radiusTab);

      expect(setMode).toHaveBeenCalledWith('radius');
    });
  });

  describe('Map UI API Controls', () => {
    const mockMapUiApi: MapUiApi = {
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      centerOnUser: jest.fn(),
      fitToResults: jest.fn(),
      exportGpx: jest.fn(),
      exportKml: jest.fn(),
      setBaseLayer: jest.fn(),
      setOverlayEnabled: jest.fn(),
      capabilities: {
        canCenterOnUser: true,
        canFitToResults: true,
        canExportRoute: true,
      },
    };

    it('should pass mapUiApi to component without errors', () => {
      // Zoom buttons are inside a collapsed section by default
      // This test verifies the component renders with mapUiApi prop
      const context = makeFiltersContext({
        filters: mockFilters,
        filterValue: mockFilterValue,
        mapUiApi: mockMapUiApi,
      });
      const { getByTestId } = render(
        <FiltersProvider {...context}>
          <FiltersPanel />
        </FiltersProvider>
      );

      // Component should render without errors
      expect(getByTestId('filters-panel')).toBeTruthy();
    });
  });

  describe('Reset Filters', () => {
    it('should call resetFilters when reset button pressed', () => {
      const resetFilters = jest.fn();
      const context = makeFiltersContext({
        filters: mockFilters,
        filterValue: mockFilterValue,
        mode: 'radius',
        resetFilters,
      });
      const { getByTestId } = render(
        <FiltersProvider {...context}>
          <FiltersPanel />
        </FiltersProvider>
      );

      const resetButton = getByTestId('filters-reset-button');
      fireEvent.press(resetButton);

      expect(resetFilters).toHaveBeenCalled();
    });
  });
});
