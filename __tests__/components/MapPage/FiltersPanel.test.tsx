import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { ThemeProvider } from '@/hooks/useTheme';
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

const renderWithTheme = (ui: React.ReactNode) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('FiltersPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getByTestId, getByText } = renderWithTheme(<FiltersPanel {...defaultProps} />);
        expect(getByTestId('filters-panel')).toBeTruthy();
        expect(getByText('Радиус')).toBeTruthy();
        expect(getByText('Маршрут')).toBeTruthy();
    });

    it('shows reset button when filters are active', () => {
        const propsWithFilters = {
            ...defaultProps,
            filterValue: {
                ...mockFilterValue,
                categories: ['Музеи'],
            },
        };
        const { getByLabelText } = renderWithTheme(<FiltersPanel {...propsWithFilters} />);
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
        const { getByLabelText } = renderWithTheme(<FiltersPanel {...propsWithFilters} />);
        const resetButton = getByLabelText('Сбросить');
        fireEvent.press(resetButton);
        expect(defaultProps.resetFilters).toHaveBeenCalled();
    });

    it('switches between radius and route modes', () => {
        const { getByText } = renderWithTheme(<FiltersPanel {...defaultProps} />);
        const routeTab = getByText('Маршрут');
        fireEvent.press(routeTab);
        expect(defaultProps.setMode).toHaveBeenCalledWith('route');
    });

    it('calls onFilterChange when radius is changed', () => {
        const { getByText } = renderWithTheme(<FiltersPanel {...defaultProps} />);
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
      const { getByText } = renderWithTheme(<FiltersPanel {...propsWithData} />);
      expect(getByText(/3\s+мест\s+•\s+60\s*км/i)).toBeTruthy();
  });

  it('keeps build button disabled until start and finish are set', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    };
    const { getByLabelText, rerender } = renderWithTheme(<FiltersPanel {...propsRouteMode} />);
    const buildButton = getByLabelText('Построить маршрут');
    expect(buildButton.props.accessibilityState?.disabled).toBe(true);
    expect(buildButton.props.children).toBeTruthy();

    // Only start selected
    const startOnly: RoutePoint[] = [makePoint('s', 53.9, 27.5, 'start')];
    rerender(<ThemeProvider><FiltersPanel {...propsRouteMode} routePoints={startOnly} /></ThemeProvider>);
    expect(getByLabelText('Построить маршрут').props.accessibilityState?.disabled).toBe(true);

    // Start + finish selected
    const startFinish: RoutePoint[] = [
      makePoint('s', 53.9, 27.5, 'start'),
      makePoint('f', 53.95, 27.6, 'end'),
    ];
    rerender(<ThemeProvider><FiltersPanel {...propsRouteMode} routePoints={startFinish} /></ThemeProvider>);
    const enabledButton = getByLabelText('Построить маршрут');
    expect(enabledButton.props.accessibilityState?.disabled).not.toBe(true);
    expect(enabledButton.props.children).toBeTruthy();

    // After distance calculated -> label changes to Пересчитать маршрут
    rerender(<ThemeProvider><FiltersPanel {...propsRouteMode} routePoints={startFinish} routeDistance={12000} /></ThemeProvider>);
    expect(getByLabelText('Построить маршрут').props.children).toBeTruthy();
  });

  it('shows inline step hints for start/end', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    };
    const { getByText, rerender, getAllByText, queryAllByText } = renderWithTheme(
      <FiltersPanel {...propsRouteMode} />
    );

    // Текст может встречаться в нескольких местах (CTA + helperText)
    expect(getAllByText(/добавьте старт и финиш/i).length).toBeGreaterThan(0);

    // After start selected, route is still incomplete => hint remains
    rerender(
      <ThemeProvider>
        <FiltersPanel
          {...propsRouteMode}
          routePoints={[makePoint('s', 53.9, 27.5, 'start')]}
        />
      </ThemeProvider>
    );

    expect(queryAllByText(/добавьте старт и финиш/i).length).toBeGreaterThan(0);

    // After start + finish selected => hint disappears
    rerender(
      <ThemeProvider>
        <FiltersPanel
          {...propsRouteMode}
          routePoints={[
            makePoint('s', 53.9, 27.5, 'start'),
            makePoint('f', 53.95, 27.6, 'end'),
          ]}
        />
      </ThemeProvider>
    );
    expect(queryAllByText(/добавьте старт и финиш/i)).toHaveLength(0);
  });

  it('disables transport selection until both points are chosen', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    };
    const { getByText, rerender } = renderWithTheme(<FiltersPanel {...propsRouteMode} />);
    const carTab = getByText('Авто');
    expect(carTab.props.accessibilityState?.disabled).toBe(true);

    rerender(
      <ThemeProvider>
        <FiltersPanel
          {...propsRouteMode}
          routePoints={[
            makePoint('s', 53.9, 27.5, 'start'),
            makePoint('f', 53.95, 27.6, 'end'),
          ]}
        />
      </ThemeProvider>
    );
    const carTabEnabled = getByText('Авто');
    expect(carTabEnabled.props.accessibilityState?.disabled).toBe(false);
  });
});
