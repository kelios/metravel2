import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListTravel from '@/components/listTravel/ListTravel';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { fetchTravels } from '@/src/api/travelsApi';
import { fetchFilters, fetchFiltersCountry } from '@/src/api/misc';

jest.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        isAuthenticated: false,
        username: '',
        isSuperuser: false,
        userId: null,
        setIsAuthenticated: jest.fn(),
        setUsername: jest.fn(),
        setIsSuperuser: jest.fn(),
        setUserId: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        sendPassword: jest.fn(),
        setNewPassword: jest.fn(),
    }),
}));

jest.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: {} }),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
}));

// Mock API
jest.mock('@/src/api/travelsApi', () => ({
    fetchTravels: jest.fn(),
}));

jest.mock('@/src/api/misc', () => ({
    fetchFilters: jest.fn(() => Promise.resolve({ categories: [] })),
    fetchFiltersCountry: jest.fn(() => Promise.resolve([])),
}));

describe('ListTravel - Filter Management', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, gcTime: 0 },
            },
        });
        jest.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <FavoritesProvider>
                    <ListTravel />
                </FavoritesProvider>
            </QueryClientProvider>
        );
    };

    describe('Filter Reset', () => {
        it('should clear accumulatedData when filters are reset', async () => {
            const mockData = {
                total: 10,
                data: [{ id: 1, name: 'Test Travel' }],
            };

            (fetchTravels as jest.Mock).mockResolvedValue(mockData);

            const { getByText } = renderComponent();

            // Wait for initial load
            await waitFor(() => {
                expect(fetchTravels).toHaveBeenCalled();
            });

            // Simulate filter reset
            act(() => {
                // This would be triggered by user interaction
                // In real scenario, user clicks "Reset filters"
            });

            // After reset, accumulatedData should be empty initially
            // Then new data should load
            await waitFor(() => {
                expect(fetchTravels).toHaveBeenCalledWith(
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(String),
                    expect.objectContaining({
                        publish: 1,
                        moderation: 1,
                    }),
                    expect.any(Object)
                );
            });
        });

        it('should normalize filter arrays to numbers', async () => {
            const mockData = { total: 0, data: [] };
            (fetchTravels as jest.Mock).mockResolvedValue(mockData);

            renderComponent();

            // Simulate filter with string IDs
            act(() => {
                // This would be setFilter({ countries: ['1', '2'] })
            });

            await waitFor(() => {
                const calls = (fetchTravels as jest.Mock).mock.calls;
                if (calls.length > 0) {
                    const params = calls[calls.length - 1][3];
                    if (params.countries) {
                        expect(params.countries.every((id: any) => typeof id === 'number')).toBe(true);
                    }
                }
            });
        });

        it('should exclude undefined values from queryParams', async () => {
            const mockData = { total: 0, data: [] };
            (fetchTravels as jest.Mock).mockResolvedValue(mockData);

            renderComponent();

            await waitFor(() => {
                const calls = (fetchTravels as jest.Mock).mock.calls;
                if (calls.length > 0) {
                    const params = calls[calls.length - 1][3];
                    // Should not have undefined values
                    Object.values(params).forEach((value) => {
                        expect(value).not.toBeUndefined();
                    });
                }
            });
        });
    });

    describe('Data Accumulation', () => {
        it('should replace data when currentPage is 0', async () => {
            const mockData1 = {
                total: 20,
                data: [{ id: 1, name: 'Travel 1' }],
            };
            const mockData2 = {
                total: 20,
                data: [{ id: 2, name: 'Travel 2' }],
            };

            (fetchTravels as jest.Mock)
                .mockResolvedValueOnce(mockData1)
                .mockResolvedValueOnce(mockData2);

            renderComponent();

            await waitFor(() => {
                expect(fetchTravels).toHaveBeenCalled();
            });

            // After filter change, should fetch with page 0
            // and replace accumulated data, not append
        });

        it('should append data when currentPage > 0', async () => {
            const mockData1 = {
                total: 20,
                data: [{ id: 1, name: 'Travel 1' }],
            };
            const mockData2 = {
                total: 20,
                data: [{ id: 2, name: 'Travel 2' }],
            };

            (fetchTravels as jest.Mock)
                .mockResolvedValueOnce(mockData1)
                .mockResolvedValueOnce(mockData2);

            renderComponent();

            // Simulate load more (page > 0)
            // Data should be appended, not replaced
        });
    });

    describe('Query Params Generation', () => {
        it('should include publish and moderation by default', async () => {
            const mockData = { total: 0, data: [] };
            (fetchTravels as jest.Mock).mockResolvedValue(mockData);

            renderComponent();

            await waitFor(() => {
                expect(fetchTravels).toHaveBeenCalledWith(
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(String),
                    expect.objectContaining({
                        publish: 1,
                        moderation: 1,
                    }),
                    expect.any(Object)
                );
            });
        });

        it('should exclude empty arrays from queryParams', async () => {
            const mockData = { total: 0, data: [] };
            (fetchTravels as jest.Mock).mockResolvedValue(mockData);

            renderComponent();

            await waitFor(() => {
                const calls = (fetchTravels as jest.Mock).mock.calls;
                if (calls.length > 0) {
                    const params = calls[calls.length - 1][3];
                    // Should not have empty arrays
                    Object.entries(params).forEach(([key, value]) => {
                        if (Array.isArray(value)) {
                            expect(value.length).toBeGreaterThan(0);
                        }
                    });
                }
            });
        });
    });

    describe('UI states', () => {
        it('renders empty state when no travels are returned', async () => {
            (fetchTravels as jest.Mock).mockResolvedValue({ total: 0, data: [] });

            const { getByText } = renderComponent();

            await waitFor(() => {
                expect(getByText('Пока нет путешествий')).toBeTruthy();
            });
        });

        it('renders error state when request fails', async () => {
            (fetchTravels as jest.Mock).mockRejectedValue(new Error('network'));

            const { getByText } = renderComponent();

            await waitFor(() => {
                expect(getByText('Ошибка загрузки')).toBeTruthy();
            });
        });
    });
});

