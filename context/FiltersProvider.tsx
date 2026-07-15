import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import type { FilterSelectionState, FiltersContextType } from '@/types/types';

const FiltersContext = createContext<FiltersContextType | undefined>(undefined);

export function useFilters() {
    const context = useContext(FiltersContext);
    if (context === undefined) {
        throw new Error('useFilters must be used within a FiltersProvider');
    }
    return context;
};

interface FiltersProviderProps {
    children: ReactNode;
}

export function FiltersProvider({ children }: FiltersProviderProps) {
    // Хук useState вызываем на верхнем уровне компонента
    const [filters, setFilters] = useState<FilterSelectionState>({
        countries: [],
        categories: [],
        categoryTravelAddress: [],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        transports: [],
        year: ''
    });

    const updateFilters = useCallback((newFilters: Partial<FilterSelectionState>) => {
        setFilters((prevFilters) => ({
            ...prevFilters,
            ...newFilters,
        }));
    }, []);

    const value = useMemo(() => ({ filters, updateFilters }), [filters, updateFilters]);

    return (
        <FiltersContext.Provider value={value}>
            {children}
        </FiltersContext.Provider>
    );
};

export default useFilters;
