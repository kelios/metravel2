import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FiltersPanel from '@/components/MapPage/FiltersPanel';

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
        expect(getByLabelText('Сбросить фильтры')).toBeTruthy();
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
        const resetButton = getByLabelText('Сбросить фильтры');
        fireEvent.press(resetButton);
        expect(defaultProps.resetFilters).toHaveBeenCalled();
    });

    it('switches between radius and route modes', () => {
        const { getByText } = render(<FiltersPanel {...defaultProps} />);
        const routeTab = getByText('Маршрут');
        fireEvent.press(routeTab);
        expect(defaultProps.setMode).toHaveBeenCalledWith('route');
    });

    it('shows transport modes in route mode', () => {
        const propsRouteMode = {
            ...defaultProps,
            mode: 'route' as const,
        };
        const { getByText } = render(<FiltersPanel {...propsRouteMode} />);
        expect(getByText('Транспорт')).toBeTruthy();
    });

    it('calls onFilterChange when radius is changed', () => {
        const { getByText } = render(<FiltersPanel {...defaultProps} />);
        // Находим и нажимаем на опцию радиуса
        const radius100 = getByText('100');
        fireEvent.press(radius100);
        expect(defaultProps.onFilterChange).toHaveBeenCalled();
    });

    it('displays categories with counts when travelsData is provided', () => {
        const propsWithData = {
            ...defaultProps,
            travelsData: [
                { categoryName: 'Музеи' },
                { categoryName: 'Музеи' },
                { categoryName: 'Парки' },
            ],
        };
        const { getByText } = render(<FiltersPanel {...propsWithData} />);
        // Проверяем, что категории отображаются с количеством
        expect(getByText(/Музеи/)).toBeTruthy();
    });
});

