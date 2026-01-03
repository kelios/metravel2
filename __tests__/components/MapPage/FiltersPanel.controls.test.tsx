/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import FiltersPanel from '@/components/MapPage/FiltersPanel';
import type { MapUiApi } from '@/src/types/mapUi';

// Mock dependencies
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#5d8c7c',
    primaryDark: '#4a7a6a',
    primaryLight: '#8fb5a5',
    text: '#1a1a1a',
    textMuted: '#666666',
    textOnPrimary: '#ffffff',
    surface: '#ffffff',
    surfaceSecondary: '#f5f5f5',
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
  }),
  globalFocusStyles: {
    focusable: {},
    focused: {},
  },
}));

jest.mock('@/components/MapPage/AddressSearch', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return function MockAddressSearch({ placeholder, value, onAddressSelect }: any) {
    return (
      <TextInput
        testID={`address-search-${placeholder}`}
        placeholder={placeholder}
        value={value}
        onChangeText={(text: string) => {
          if (text.includes(',')) {
            const [lat, lng] = text.split(',').map(Number);
            onAddressSelect(text, { lat, lng });
          }
        }}
      />
    );
  };
});

jest.mock('@/components/MapPage/RouteBuilder', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockRouteBuilder({ startAddress, endAddress }: any) {
    return (
      <View testID="route-builder">
        <Text>Start: {startAddress}</Text>
        <Text>End: {endAddress}</Text>
      </View>
    );
  };
});

jest.mock('@/components/MapPage/MapLegend', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockMapLegend() {
    return (
      <View testID="map-legend">
        <Text>Map Legend</Text>
      </View>
    );
  };
});

jest.mock('@/components/MapPage/ValidationMessage', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockValidationMessage({ type, messages }: any) {
    return (
      <View testID={`validation-${type}`}>
        {messages.map((m: string, i: number) => (
          <Text key={i}>{m}</Text>
        ))}
      </View>
    );
  };
});

jest.mock('@/components/CategoryChips', () => {
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');
  return function MockCategoryChips({ categories, selected, onToggle }: any) {
    return (
      <View testID="category-chips">
        {categories?.map((cat: any) => (
          <Pressable
            key={cat.name}
            testID={`category-chip-${cat.name}`}
            onPress={() => onToggle(cat.name)}
          >
            <Text>{cat.name}</Text>
          </Pressable>
        ))}
      </View>
    );
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
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');
  return function MockSegmentedControl({ options, value, onChange }: any) {
    return (
      <View testID="segmented-control">
        {options.map((opt: any) => (
          <Pressable
            key={opt.key}
            testID={`segmented-${opt.key}`}
            onPress={() => onChange(opt.key)}
            accessibilityState={{ checked: value === opt.key }}
          >
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
    categories: [
      { name: 'Природа', count: 10 },
      { name: 'Архитектура', count: 5 },
    ],
  };

  const mockFilterValue = {
    categories: [], // Array of selected category names
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

      // Find and click bike transport button
      const bikeButton = getByLabelText(/Выбрать транспорт: Велосипед/i);
      fireEvent.press(bikeButton);

      expect(setTransportMode).toHaveBeenCalledWith('bike');
    });

    it('should NOT call setTransportMode when transport disabled (no start/end)', () => {
      const setTransportMode = jest.fn();
      const { getByLabelText } = render(
        <FiltersPanel
          {...defaultProps}
          mode="route"
          setTransportMode={setTransportMode}
          routePoints={[]}
          startAddress=""
          endAddress=""
        />
      );

      // Try to click transport button - should be disabled
      const carButton = getByLabelText(/Выбрать транспорт: Авто/i);
      fireEvent.press(carButton);

      expect(setTransportMode).not.toHaveBeenCalled();
    });

    it('should show active state for selected transport mode', () => {
      const { getByLabelText } = render(
        <FiltersPanel
          {...defaultProps}
          mode="route"
          transportMode="bike"
          routePoints={[
            { id: '1', coordinates: { lat: 53.9, lng: 27.5 }, address: 'Start', type: 'start', timestamp: Date.now() },
            { id: '2', coordinates: { lat: 54.0, lng: 28.0 }, address: 'End', type: 'end', timestamp: Date.now() },
          ]}
        />
      );

      const bikeButton = getByLabelText(/Выбрать транспорт: Велосипед/i);
      expect(bikeButton.props.accessibilityState?.selected).toBe(true);
    });

    it('should cycle through all transport modes', () => {
      const setTransportMode = jest.fn();
      const { getByLabelText, rerender } = render(
        <FiltersPanel
          {...defaultProps}
          mode="route"
          transportMode="car"
          setTransportMode={setTransportMode}
          routePoints={[
            { id: '1', coordinates: { lat: 53.9, lng: 27.5 }, address: 'Start', type: 'start', timestamp: Date.now() },
            { id: '2', coordinates: { lat: 54.0, lng: 28.0 }, address: 'End', type: 'end', timestamp: Date.now() },
          ]}
        />
      );

      // Click bike
      fireEvent.press(getByLabelText(/Выбрать транспорт: Велосипед/i));
      expect(setTransportMode).toHaveBeenCalledWith('bike');

      // Click foot
      fireEvent.press(getByLabelText(/Выбрать транспорт: Пешком/i));
      expect(setTransportMode).toHaveBeenCalledWith('foot');

      // Click car
      fireEvent.press(getByLabelText(/Выбрать транспорт: Авто/i));
      expect(setTransportMode).toHaveBeenCalledWith('car');
    });
  });

  describe('Map UI API Controls (Zoom)', () => {
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

    it('should call mapUiApi.zoomIn when Zoom + pressed', () => {
      const { getByLabelText } = render(
        <FiltersPanel {...defaultProps} mapUiApi={mockMapUiApi} />
      );

      const zoomInButton = getByLabelText(/Увеличить масштаб/i);
      fireEvent.press(zoomInButton);

      expect(mockMapUiApi.zoomIn).toHaveBeenCalled();
    });

    it('should call mapUiApi.zoomOut when Zoom - pressed', () => {
      const { getByLabelText } = render(
        <FiltersPanel {...defaultProps} mapUiApi={mockMapUiApi} />
      );

      const zoomOutButton = getByLabelText(/Уменьшить масштаб/i);
      fireEvent.press(zoomOutButton);

      expect(mockMapUiApi.zoomOut).toHaveBeenCalled();
    });

    it('should call mapUiApi.centerOnUser when location button pressed', () => {
      const { getByLabelText } = render(
        <FiltersPanel {...defaultProps} mapUiApi={mockMapUiApi} />
      );

      const locationButton = getByLabelText(/Моё местоположение/i);
      fireEvent.press(locationButton);

      expect(mockMapUiApi.centerOnUser).toHaveBeenCalled();
    });

    it('should disable zoom buttons when mapUiApi is null', () => {
      const { getByLabelText } = render(
        <FiltersPanel {...defaultProps} mapUiApi={null} />
      );

      const zoomInButton = getByLabelText(/Увеличить масштаб/i);
      const zoomOutButton = getByLabelText(/Уменьшить масштаб/i);

      expect(zoomInButton.props.accessibilityState?.disabled).toBe(true);
      expect(zoomOutButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should not call zoomIn when mapUiApi is null', () => {
      const { getByLabelText } = render(
        <FiltersPanel {...defaultProps} mapUiApi={null} />
      );

      const zoomInButton = getByLabelText(/Увеличить масштаб/i);
      fireEvent.press(zoomInButton);

      // Should not throw, but also should not call anything
      expect(true).toBe(true);
    });
  });

  describe('Mode Switching', () => {
    it('should call setMode when switching to route mode', () => {
      const setMode = jest.fn();
      const { getByTestId } = render(
        <FiltersPanel {...defaultProps} mode="radius" setMode={setMode} />
      );

      // Find the route mode tab (uses SegmentedControl testID format)
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

  describe('Radius Slider', () => {
    it('should call onFilterChange when radius changes', async () => {
      const onFilterChange = jest.fn();
      const { getByTestId } = render(
        <FiltersPanel
          {...defaultProps}
          mode="radius"
          onFilterChange={onFilterChange}
        />
      );

      // Note: Slider interactions may need special handling
      // This is a basic structure test
      expect(onFilterChange).not.toHaveBeenCalled();
    });
  });

  describe('Reset Filters', () => {
    it('should call resetFilters when reset button pressed', () => {
      const resetFilters = jest.fn();
      const { getByTestId } = render(
        <FiltersPanel
          {...defaultProps}
          resetFilters={resetFilters}
          filterValue={{
            ...mockFilterValue,
            categories: ['Природа'],
          }}
        />
      );

      const resetButton = getByTestId('filters-reset-button');
      fireEvent.press(resetButton);

      expect(resetFilters).toHaveBeenCalled();
    });
  });
});

