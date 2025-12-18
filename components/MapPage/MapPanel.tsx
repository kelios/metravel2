import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import { useLazyMap } from '@/hooks/useLazyMap';

type LatLng = { latitude: number; longitude: number };

interface MapPanelProps {
    travelsData: any[];
    coordinates: LatLng;
    routePoints?: [number, number][];
    placesAlongRoute?: any[];
    mode?: 'radius' | 'route';
    setRoutePoints?: (points: [number, number][]) => void;
    onMapClick?: (lng: number, lat: number) => void;
    transportMode?: 'car' | 'bike' | 'foot';
    setRouteDistance: (distance: number) => void;
    setFullRouteCoords: (coords: [number, number][]) => void;
    radius?: string; // Радиус поиска в км
}

/** Плейсхолдер для нативных платформ или во время загрузки карты */
function Placeholder({ text = 'Карта доступна только в браузере' }: { text?: string }) {
    return (
        <View style={styles.placeholder}>
            <ActivityIndicator size="large" />
            <Text style={styles.placeholderText}>{text}</Text>
        </View>
    );
}

const MapPanel: React.FC<MapPanelProps> = ({
                                               travelsData,
                                               coordinates,
                                               routePoints = [],
                                               placesAlongRoute = [],
                                               mode = 'radius',
                                               setRoutePoints = () => {},
                                               onMapClick = () => {},
                                               transportMode = 'car',
                                               setRouteDistance,
                                               setFullRouteCoords,
                                               radius,
                                           }) => {
    const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

    // ✅ УЛУЧШЕНИЕ: Ленивая загрузка карты с Intersection Observer
    const { shouldLoad, setElementRef } = useLazyMap({
        rootMargin: '200px',
        threshold: 0.1,
        enabled: isWeb,
    });

    // Динамически импортируем веб-карту, только в браузере и когда нужно
    const [WebMap, setWebMap] = useState<React.ComponentType<any> | null>(null);
    const [loading, setLoading] = useState(isWeb && shouldLoad);

    useEffect(() => {
        let mounted = true;
        if (!isWeb || !shouldLoad) return;

        (async () => {
            try {
                const mod = await import('@/components/MapPage/Map');
                if (mounted) setWebMap(() => (mod.default ?? mod as any));
            } catch (e) {
                console.error('[MapPanel] Failed to load web map:', e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isWeb, shouldLoad]);

    const travelProp = useMemo(() => ({ data: travelsData }), [travelsData]);

    if (!isWeb) return <Placeholder />;

    if (!shouldLoad) {
        return (
            <View 
                style={styles.mapContainer}
                ref={setElementRef as any}
            >
                <Placeholder text="Карта загрузится при прокрутке…" />
            </View>
        );
    }

    if (loading || !WebMap) {
        return <Placeholder text="Инициализация карты…" />;
    }

    return (
        <View 
            style={styles.mapContainer}
            ref={setElementRef as any}
        >
            <WebMap
                travel={travelProp}
                coordinates={coordinates}
                routePoints={routePoints}
                placesAlongRoute={placesAlongRoute}
                mode={mode}
                setRoutePoints={setRoutePoints}
                onMapClick={onMapClick}
                transportMode={transportMode}
                setRouteDistance={setRouteDistance}
                setFullRouteCoords={setFullRouteCoords}
                radius={radius}
            />
        </View>
    );
};

export default React.memo(MapPanel);

const styles = StyleSheet.create({
    mapContainer: {
        flex: 1,
        ...(Platform.OS === 'web'
            ? ({
                  width: '100%',
                  height: '100%',
                  minHeight: 0,
                  position: 'relative',
              } as any)
            : null),
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        borderRadius: 16,
        backgroundColor: '#fff',
    },
    placeholderText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
});
