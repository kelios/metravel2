import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FiltersPanel from '@/components/MapPage/FiltersPanel';
import type { RoutePoint } from '@/types/route';

// Моки
jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
        ...RN,
        useWindowDimensions: () => ({ width: 1024, height: 768 }),
        Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
    };
});

const mockFilters = {
    categories: [
        { id: 1, name: 'Музеи' },
        { id: 2, name: 'Парки' },
    ],
    radius: [
        { id: '60', name: '60' },
        { id: '100', name: '100' },
    ],
    address: '',
};

const mockFilterValue = {
    categories: [],
    radius: '60',
    address: '',
};

const makePoint = (id: string, lat: number, lng: number, type: RoutePoint['type']): RoutePoint => ({
    id,
    coordinates: { lat, lng },
    address: '',
    type,
    timestamp: Date.now(),
});

const defaultProps = {
    filters: mockFilters,
    filterValue: mockFilterValue,
    onFilterChange: jest.fn(),
    onTextFilterChange: jest.fn(),
    resetFilters: jest.fn(),
    travelsData: [],
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
    onBuildRoute: jest.fn(),
};

describe('FiltersPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getByText } = render(<FiltersPanel {...defaultProps} />);
        expect(getByText('Фильтры')).toBeTruthy();
    });

    it('shows reset button when filters are active', () => {
        const propsWithFilters = {
            ...defaultProps,
            filterValue: {
                ...mockFilterValue,
                categories: ['Музеи'],
            },
        };
        const { getByLabelText } = render(<FiltersPanel {...propsWithFilters} />);
        expect(getByLabelText('Сбросить')).toBeTruthy();
    });

    it('calls resetFilters when reset button is pressed', () => {
        const propsWithFilters = {
            ...defaultProps,
            filterValue: {
                ...mockFilterValue,
                categories: ['Музеи'],
            },
        };
        const { getByLabelText } = render(<FiltersPanel {...propsWithFilters} />);
        const resetButton = getByLabelText('Сбросить');
        fireEvent.press(resetButton);
        expect(defaultProps.resetFilters).toHaveBeenCalled();
    });

    it('switches between radius and route modes', () => {
        const { getByText } = render(<FiltersPanel {...defaultProps} />);
        const routeTab = getByText('Маршрут');
        fireEvent.press(routeTab);
        expect(defaultProps.setMode).toHaveBeenCalledWith('route');
    });

    it('calls onFilterChange when radius is changed', () => {
        const { getByText } = render(<FiltersPanel {...defaultProps} />);
        // Находим и нажимаем на опцию радиуса
        const radius100 = getByText('100');
        fireEvent.press(radius100);
        expect(defaultProps.onFilterChange).toHaveBeenCalled();
    });

    it('displays counter with radius wording when filters active', () => {
      const propsWithData = {
        ...defaultProps,
        filterValue: {
          ...mockFilterValue,
          categories: ['Музеи'],
        },
        travelsData: [
          { categoryName: 'Музеи' },
          { categoryName: 'Музеи' },
          { categoryName: 'Парки' },
        ],
      };
      const { getByText } = render(<FiltersPanel {...propsWithData} />);
      expect(getByText('3')).toBeTruthy();
      expect(getByText(/мест в радиусе 60 км/i)).toBeTruthy();
  });

  it('keeps build button disabled until start and finish are set', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    };
    const { getByLabelText, rerender } = render(<FiltersPanel {...propsRouteMode} />);
    const buildButton = getByLabelText('Построить маршрут');
    expect(buildButton.props.accessibilityState?.disabled).toBe(true);
    expect(buildButton.props.children).toBeTruthy();

    // Only start selected
    const startOnly: RoutePoint[] = [makePoint('s', 53.9, 27.5, 'start')];
    rerender(<FiltersPanel {...propsRouteMode} routePoints={startOnly} />);
    expect(getByLabelText('Построить маршрут').props.accessibilityState?.disabled).toBe(true);

    // Start + finish selected
    const startFinish: RoutePoint[] = [
      makePoint('s', 53.9, 27.5, 'start'),
      makePoint('f', 53.95, 27.6, 'end'),
    ];
    rerender(<FiltersPanel {...propsRouteMode} routePoints={startFinish} />);
    const enabledButton = getByLabelText('Построить маршрут');
    expect(enabledButton.props.accessibilityState?.disabled).not.toBe(true);
    expect(enabledButton.props.children).toBeTruthy();

    // After distance calculated -> label changes to Пересчитать маршрут
    rerender(<FiltersPanel {...propsRouteMode} routePoints={startFinish} routeDistance={12000} />);
    expect(getByLabelText('Построить маршрут').props.children).toBeTruthy();
  });

  it('shows inline step hints for start/end', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    };
    const { getByText, rerender, queryByText } = render(<FiltersPanel {...propsRouteMode} />);
    expect(getByText(/кликните на карте/i)).toBeTruthy();

    // After start selected, start hint hides, end hint shows
    rerender(
      <FiltersPanel
        {...propsRouteMode}
        routePoints={[makePoint('s', 53.9, 27.5, 'start')]}
      />
    );
    expect(queryByText(/кликните на карте/i)).toBeNull();
    expect(getByText(/теперь выберите финиш/i)).toBeTruthy();
  });

  it('disables transport selection until both points are chosen', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    };
    const { getByText, rerender } = render(<FiltersPanel {...propsRouteMode} />);
    const carTab = getByText('Авто');
    expect(carTab.props.accessibilityState?.disabled).toBe(true);

    rerender(
      <FiltersPanel
        {...propsRouteMode}
        routePoints={[
          makePoint('s', 53.9, 27.5, 'start'),
          makePoint('f', 53.95, 27.6, 'end'),
        ]}
      />
    );
    const carTabEnabled = getByText('Авто');
    expect(carTabEnabled.props.accessibilityState?.disabled).toBe(false);
  });
});
