// ПРИМЕР: Оптимизированная версия map.tsx
// Демонстрирует использование debounce и React Query для улучшения производительности
// 
// Для применения: скопируйте изменения в app/(tabs)/map.tsx

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { fetchTravelsForMap, fetchTravelsNearRoute } from '@/src/api/travels';

// ... остальные импорты

export default function MapScreen() {
    // ... существующий код до filterValues

    // ✅ ОПТИМИЗАЦИЯ 1: Debounce для фильтров и координат
    const debouncedCoordinates = useDebouncedValue(coordinates, 500);
    const debouncedFilterValues = useDebouncedValue(filterValues, 300);
    const debouncedRoutePoints = useDebouncedValue(routePoints, 500);

    // ✅ ОПТИМИЗАЦИЯ 2: Использование React Query вместо useState + useEffect
    const {
        data: travelsData = [],
        isLoading,
        isFetching,
        isPreviousData,
    } = useQuery({
        queryKey: [
            'travelsForMap',
            debouncedCoordinates,
            debouncedFilterValues,
            mode,
            debouncedRoutePoints,
            transportMode,
        ],
        queryFn: async () => {
            if (mode === 'radius') {
                const result = await fetchTravelsForMap(0, 100, {
                    lat: debouncedCoordinates.latitude.toString(),
                    lng: debouncedCoordinates.longitude.toString(),
                    radius: debouncedFilterValues.radius || '60',
                    categories: debouncedFilterValues.categories,
                });
                return Object.values(result || {});
            } else if (mode === 'route' && debouncedRoutePoints.length >= 2) {
                const result = await fetchTravelsNearRoute(debouncedRoutePoints, 2);
                if (result && typeof result === 'object') {
                    return Array.isArray(result) ? result : Object.values(result);
                }
                return [];
            }
            return [];
        },
        enabled: isFocused, // Загружать только когда экран в фокусе
        staleTime: 2 * 60 * 1000, // 2 минуты - данные считаются свежими
        cacheTime: 10 * 60 * 1000, // 10 минут - хранить в кеше
        keepPreviousData: true, // Показывать старые данные во время загрузки
        refetchOnWindowFocus: false, // Не перезагружать при фокусе окна
    });

    // Удалить старый useEffect для loadTravels - теперь используется React Query

    // ... остальной код без изменений

    return (
        <>
            {/* ... существующий JSX */}
            
            {/* ✅ ОПТИМИЗАЦИЯ 3: Показывать предыдущие данные во время загрузки */}
            {isFetching && !isPreviousData && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" />
                    <Text style={styles.loadingText}>Обновление данных...</Text>
                </View>
            )}
        </>
    );
}

