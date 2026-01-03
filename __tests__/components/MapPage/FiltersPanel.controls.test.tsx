/**
 * @jest-environment jsdom
 */
import { render, fireEvent } from '@testing-library/react-native';
import FiltersPanel from '@/components/MapPage/FiltersPanel';
import type { MapUiApi } from '@/src/types/mapUi';

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
  return function MockRouteBuilder({ startAddress, endAddress }: any) {
    return <View testID="route-builder"><Text>Start: {startAddress}</Text><Text>End: {endAddress}</Text></View>;
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

jest.mock('@/components/CategoryChips', () => {
  const { View } = require('react-native');
  return function MockCategoryChips() {
    return <View testID="category-chips" />;
  };
});

jest.mock('@/components/CollapsibleBlock', () => {
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
    radius: ['60', '100', '200'],
  };

  const mockFilterValue = {
    categories: [],
    radius: '60',
    sortBy: 'distance',
    sortOrder: 'asc',
  };

  const defaultProps = {
    filters: mockFilters,
    filterValue: mockFilterValue,
    onFilterChange: jest.fn(),
    resetFilters: jest.fn(),
    travelsData: [],
    filteredTravelsData: [],
    isMobile: false,
    closeMenu: jest.fn(),
    mode: 'radius' as const,
    setMode: jest.fn(),
    transportMode: 'car' as const,
    setTransportMode: jest.fn(),
    startAddress: '',
    endAddress: '',
    routeDistance: null,
    routePoints: [],
    onClearRoute: jest.fn(),
    swapStartEnd: jest.fn(),
    mapUiApi: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Transport Mode Controls', () => {
    it('should call setTransportMode when transport button clicked and route is ready', () => {
      const setTransportMode = jest.fn();
      const { getByLabelText } = render(
        <FiltersPanel
          {...defaultProps}
          mode="route"
          setTransportMode={setTransportMode}
          routePoints={[
            { id: '1', coordinates: { lat: 53.9, lng: 27.5 }, address: 'Start', type: 'start', timestamp: Date.now() },
            { id: '2', coordinates: { lat: 54.0, lng: 28.0 }, address: 'End', type: 'end', timestamp: Date.now() },
          ]}
          startAddress="Start Address"
          endAddress="End Address"
        />
      );

      const bikeButton = getByLabelText(/Выбрать транспорт: Велосипед/i);
      fireEvent.press(bikeButton);

      expect(setTransportMode).toHaveBeenCalledWith('bike');
    });

    it('should NOT call setTransportMode when no route points', () => {
      const setTransportMode = jest.fn();
      const { getByLabelText } = render(
        <FiltersPanel {...defaultProps} mode="route" setTransportMode={setTransportMode} />
      );

      const carButton = getByLabelText(/Выбрать транспорт: Авто/i);
      fireEvent.press(carButton);

      expect(setTransportMode).not.toHaveBeenCalled();
    });
  });

  describe('Mode Switching', () => {
    it('should call setMode when switching to route mode', () => {
      const setMode = jest.fn();
      const { getByTestId } = render(
        <FiltersPanel {...defaultProps} mode="radius" setMode={setMode} />
      );

      const routeTab = getByTestId('segmented-route');
      fireEvent.press(routeTab);

      expect(setMode).toHaveBeenCalledWith('route');
    });

    it('should call setMode when switching to radius mode', () => {
      const setMode = jest.fn();
      const { getByTestId } = render(
        <FiltersPanel {...defaultProps} mode="route" setMode={setMode} />
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
      const { getByTestId } = render(
        <FiltersPanel {...defaultProps} mapUiApi={mockMapUiApi} />
      );

      // Component should render without errors
      expect(getByTestId('filters-panel')).toBeTruthy();
    });
  });

  describe('Reset Filters', () => {
    it('should call resetFilters when reset button pressed', () => {
      const resetFilters = jest.fn();
      const { getByTestId } = render(
        <FiltersPanel {...defaultProps} resetFilters={resetFilters} />
      );

      const resetButton = getByTestId('filters-reset-button');
      fireEvent.press(resetButton);

      expect(resetFilters).toHaveBeenCalled();
    });
  });
});
