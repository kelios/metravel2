import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MarkersListComponent from '@/components/map/MarkersListComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { ensureLeafletCss } from '@/utils/ensureLeafletCss';
import { loadLeafletRuntime } from '@/utils/loadLeafletRuntime';
import { extractGpsFromImageFile } from '@/utils/exifGps';
import { showToastMessage } from '@/utils/toast';
import { registerPendingImageFile, removePendingImageFile, getPendingImageFile } from '@/utils/pendingImageFiles';
import { matchCountryId, buildAddressFromGeocode } from '@/utils/geocodeHelpers';
import { buildLeafletPopupCss, createWebMapStyles } from '@/components/travel/WebMapComponent.styles';
import WebMapMarkerPopup from '@/components/travel/WebMapMarkerPopup';
import {
    CenterOnActive,
    FitBounds,
    MapClickHandler,
    createMarkerIcon,
    hasValidMarkerCoordinates,
    loadingStyle,
    mapHeightStyle,
} from '@/components/travel/WebMapLeafletLayers';

type LeafletNS = any;
type ReactLeafletNS = typeof import('react-leaflet');

const reverseGeocode = async (latlng: any) => {
    // Пробуем несколько сервисов для получения наиболее точного адреса.
    // Этот шаг нужен и на web: точка из фото должна сначала получить адрес/страну,
    // затем сохраниться, и только после выдачи backend id можно грузить фото точки.

    // 1. Nominatim с zoom=18 для максимальной детализации
    try {
        const nominatim = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&addressdetails=1&accept-language=ru&extratags=1&namedetails=1&zoom=18`
        );
        if (nominatim.ok) {
            const data = await nominatim.json();
            // Если есть конкретное название места, используем Nominatim
            if (data?.name || data?.address?.name || data?.display_name) {
                return data;
            }
        }
    } catch (error) {
        console.warn('Nominatim geocoding failed:', error);
    }

    // 2. BigDataCloud как fallback
    try {
        const bigdata = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latlng.lat}&longitude=${latlng.lng}&localityLanguage=ru`
        );
        if (bigdata.ok) {
            const data = await bigdata.json();
            return data;
        }
    } catch (error) {
        console.warn('BigDataCloud geocoding failed:', error);
    }

    return null;
};

export { matchCountryId, buildAddressFromGeocode };

type WebMapComponentProps = {
    markers: any[];
    onMarkersChange: (markers: any[]) => void;
    categoryTravelAddress: any[];
    countrylist: any[];
    onCountrySelect: (countryId: any) => void;
    onCountryDeselect: (countryId: any) => void;
    onPhotoMarkerReady?: (payload: { markers: any[]; derivedCountryId: number | null }) => Promise<void> | void;
    onMarkerEditSave?: (markers: any[]) => Promise<void> | void;
};

const WebMapComponent = ({
    markers,
    onMarkersChange,
    categoryTravelAddress,
    countrylist,
    onCountrySelect,
    onCountryDeselect,
    onPhotoMarkerReady,
    onMarkerEditSave,
}: WebMapComponentProps) => {
    // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
    const colors = useThemedColors();

    const [L, setL] = useState<LeafletNS | null>(null);
    const [rl, setRl] = useState<ReactLeafletNS | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let cancelled = false;

        ;(async () => {
            try {
                ensureLeafletCss();
                const { L: leafletModule, RL: reactLeafletModule } = await loadLeafletRuntime();
                if (!cancelled) {
                    setL(leafletModule as any);
                    setRl(reactLeafletModule as any);
                }
            } catch {
                if (!cancelled) {
                    setL(null);
                    setRl(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isWideLayout, setIsWideLayout] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth >= 1024;
    });
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const mapInstanceKeyRef = useRef<string>(`leaflet-map-${Math.random().toString(36).slice(2)}`);
    const [mapCreatedNonce, setMapCreatedNonce] = useState(0);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        let raf: number | null = null;
        let timeoutId: any = null;
        let cancelled = false;

        const invalidate = () => {
            if (cancelled) return;
            try {
                map.invalidateSize?.(true);
            } catch {
                // noop
            }
        };

        try {
            if (typeof requestAnimationFrame !== 'undefined') {
                raf = requestAnimationFrame(invalidate);
            } else {
                timeoutId = setTimeout(invalidate, 0);
            }
        } catch {
            // noop
        }

        try {
            if (typeof window !== 'undefined') {
                timeoutId = window.setTimeout(invalidate, 250);
            }
        } catch {
            // noop
        }

        return () => {
            cancelled = true;
            if (raf != null) {
                try {
                    cancelAnimationFrame(raf);
                } catch {
                    // noop
                }
            }
            if (timeoutId != null) {
                try {
                    clearTimeout(timeoutId);
                } catch {
                    // noop
                }
            }
        };
    }, [mapCreatedNonce, isWideLayout, isExpanded]);
    // Только для старта: если маркеры пришли извне (редактирование маршрута), разрешаем авто-fit.
    // При создании нового маршрута (маркер ставит пользователь) авто-fit отключён.
    const hasInitialMarkersRef = useRef(markers.length > 0);
    
    // Локальное состояние маркеров для немедленного отображения изменений
    const [localMarkers, setLocalMarkers] = useState(markers);
    const lastMarkersRef = useRef(markers);
    const isInternalUpdateRef = useRef(false);
    const prevExternalLengthRef = useRef<number>(markers.length);
    const activeSetByMarkerClickRef = useRef(false);
    
    // Синхронизируем локальное состояние с пропсами только при внешних изменениях
    useEffect(() => {
        // Пропускаем обновление, если изменение было инициировано внутри компонента
        if (isInternalUpdateRef.current) {
            isInternalUpdateRef.current = false;
            return;
        }

        const normalizeCoordKey = (value: any) => {
            const num = typeof value === 'number' ? value : Number(value);
            if (Number.isFinite(num)) return num.toFixed(6);
            return String(value ?? '');
        };

        const makeIdKey = (m: any) => {
            const id = m?.id != null ? String(m.id) : '';
            if (id && id !== 'null' && id !== 'undefined') return `id:${id}`;
            return '';
        };

        const makeLlKey = (m: any) => {
            const lat = normalizeCoordKey(m?.lat);
            const lng = normalizeCoordKey(m?.lng);
            return `ll:${lat},${lng}`;
        };

        // Проверяем изменения маркеров относительно последнего известного состояния
        const markersChanged =
            markers.length !== lastMarkersRef.current.length ||
            markers.some((m, idx) => {
                const prev = lastMarkersRef.current[idx];
                if (!prev) return true;
                return (
                    String(m.id ?? '') !== String(prev.id ?? '') ||
                    m.lat !== prev.lat ||
                    m.lng !== prev.lng ||
                    m.address !== prev.address ||
                    m.image !== prev.image ||
                    String(m.country ?? '') !== String(prev.country ?? '') ||
                    JSON.stringify(m.categories ?? []) !== JSON.stringify(prev.categories ?? [])
                );
            });

        if (markersChanged) {
            const prevLen = prevExternalLengthRef.current;
            
            // ✅ FIX: Используем функциональное обновление чтобы получить актуальное локальное состояние
            // без добавления localMarkers в зависимость (избегаем бесконечного цикла)
            setLocalMarkers(currentLocalMarkers => {
                const localById = new Map<string, any>();
                const localByLl = new Map<string, any>();
                (currentLocalMarkers || []).forEach((m: any) => {
                    const idKey = makeIdKey(m);
                    if (idKey) localById.set(idKey, m);
                    localByLl.set(makeLlKey(m), m);
                });

                const mergedMarkers = markers.map((m) => {
                    const idKey = makeIdKey(m);
                    const llKey = makeLlKey(m);
                    const localMarker = (idKey ? localById.get(idKey) : null) ?? localByLl.get(llKey);
                    // Backend can echo a serializer fallback image for a newly created point
                    // before the real point-photo upload finishes. As long as we still have
                    // the pending local file, prefer the local blob preview over that server
                    // fallback so the deferred upload flow can complete deterministically.
                    if (localMarker?.image && /^(blob:|data:)/i.test(String(localMarker.image))) {
                        const serverImage = m?.image;
                        const hasPendingFile = /^(blob:)/i.test(String(localMarker.image))
                            ? Boolean(getPendingImageFile(String(localMarker.image)))
                            : true;
                        if (hasPendingFile && (!serverImage || !/^(blob:|data:)/i.test(String(serverImage)))) {
                            return { ...m, image: localMarker.image };
                        }
                    }
                    return m;
                });
                lastMarkersRef.current = mergedMarkers;
                return mergedMarkers;
            });

            // Если маркер добавлен извне (например, через поиск), делаем его активным
            if (markers.length > prevLen) {
                setActiveIndex(Math.max(0, markers.length - 1));
                setIsExpanded(true);
            }

            prevExternalLengthRef.current = markers.length;
        }
    }, [markers]); // ✅ FIX: Убрали localMarkers из зависимостей
    
    // Немедленное обновление родительского компонента (без дебаунса)
    const debouncedMarkersChange = useCallback((updatedMarkers: any[]) => {
        isInternalUpdateRef.current = true;
        setLocalMarkers(updatedMarkers);
        onMarkersChange(updatedMarkers);
        lastMarkersRef.current = updatedMarkers;
    }, [onMarkersChange]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            setIsWideLayout(window.innerWidth >= 1024);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Очистка Leaflet контейнеров при размонтировании, чтобы избежать ошибки "Map container is already initialized"
    // Do NOT call map.remove() here — react-leaflet's MapContainer handles its own
    // cleanup via its unmount effect, and our leafletFix.ts patch makes that safe.
    useEffect(() => {
        const rootEl = rootRef.current;
        return () => {
            mapRef.current = null;

            // Дополнительная страховка: сбрасываем id только в контейнере ЭТОГО компонента.
            try {
                const container = rootEl?.querySelector?.('.leaflet-container') as any;
                if (container?._leaflet_id) {
                    delete container._leaflet_id;
                }
            } catch {
                // noop
            }
        };
    }, []);

    const isValidCoordinates = ({ lat, lng }: { lat: number; lng: number }) =>
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    const markerIcon = useMemo(() => createMarkerIcon(L, DESIGN_TOKENS.colors.mapPin), [L]);

    const addMarker = async (latlng: any, options?: { image?: string | null }) => {
        if (!isValidCoordinates(latlng)) return null;

        const geocodeData = await reverseGeocode(latlng);
        const country =
            geocodeData?.address?.country ||
            geocodeData?.countryName ||
            geocodeData?.localityInfo?.administrative?.find((item: any) => item?.order === 2)?.name ||
            '';
        const countryCode =
            geocodeData?.address?.country_code ||
            geocodeData?.countryCode ||
            geocodeData?.address?.ISO3166_1_alpha2 ||
            null;

        let derivedCountryId: number | null = null;

        const matchedId = matchCountryId(country || '', countrylist, countryCode);
        const matchedCountry = matchedId != null
            ? countrylist.find((c: any) => Number(c?.country_id) === matchedId)
            : null;

        const address = buildAddressFromGeocode(geocodeData, latlng, matchedCountry);

        const newMarker = {
            id: null,
            lat: latlng.lat,
            lng: latlng.lng,
            address,
            categories: [],
            image: options?.image ?? null,
            country: null as number | null,
        };

        if (matchedId != null) {
            derivedCountryId = matchedId;
            newMarker.country = derivedCountryId;
            onCountrySelect(String(derivedCountryId));
        } else {
            newMarker.country = null;
        }

        newMarker.address = address;

        // ✅ FIX: addMarker is async (reverse geocode). Use the latest known markers list
        // instead of the potentially stale `localMarkers` from closure.
        const baseMarkers = Array.isArray(lastMarkersRef.current) ? lastMarkersRef.current : localMarkers;
        const nextMarkers = [...baseMarkers, newMarker];
        debouncedMarkersChange(nextMarkers);
        setActiveIndex(Math.max(0, nextMarkers.length - 1));
        return { nextMarkers, derivedCountryId };
    };

    const handleAddMarkerFromPhoto = async (file: File) => {
        if (typeof window === 'undefined') return;
        if (typeof File === 'undefined' || !(file instanceof File)) return;

        const coords = await extractGpsFromImageFile(file);
        if (!coords) {
            void showToastMessage({
                type: 'error',
                text1: 'Нет геолокации в фото',
                text2: 'В этом файле не найден GPS в EXIF. Попробуйте другое фото или добавьте точку вручную.',
            });
            return;
        }

        let previewUrl: string | null = null;
        try {
            previewUrl = URL.createObjectURL(file);
            registerPendingImageFile(previewUrl, file);
        } catch {
            previewUrl = null;
        }

        const markerResult = await addMarker({ lat: coords.lat, lng: coords.lng }, { image: previewUrl });
        if (!markerResult) return;

        try {
            await onPhotoMarkerReady?.({
                markers: markerResult.nextMarkers,
                derivedCountryId: markerResult.derivedCountryId,
            });
        } catch {
            void showToastMessage({
                type: 'error',
                text1: 'Не удалось сохранить точку',
                text2: 'Координаты определены, но сохранение точки не завершилось. Попробуйте ещё раз.',
            });
            return;
        }

        void showToastMessage({
            type: 'success',
            text1: 'Точка добавлена',
            text2: 'Координаты взяты из геолокации фото (EXIF).',
        });
    };

    const handleEditMarker = (index: number) => {
        setEditingIndex(index);
        setActiveIndex(index);
        setIsExpanded(true);
    };

    const handleMarkerChange = (index: number, field: string, value: any) => {
        const updated = [...localMarkers];
        updated[index] = { ...updated[index], [field]: value };
        debouncedMarkersChange(updated);
    };

    const handleMarkerSave = useCallback(
        async (index: number, payload: { address: string; categories: string[]; image: string }) => {
            const updated = [...localMarkers];
            const prevMarker = updated[index];
            if (!prevMarker) return;

            updated[index] = {
                ...prevMarker,
                address: payload.address,
                categories: Array.isArray(payload.categories)
                    ? payload.categories
                          .map((categoryId) => Number(categoryId))
                          .filter((categoryId) => Number.isFinite(categoryId))
                    : [],
                image: payload.image || null,
            };

            debouncedMarkersChange(updated);
            await onMarkerEditSave?.(updated);
        },
        [debouncedMarkersChange, localMarkers, onMarkerEditSave]
    );

    const handleImageUpload = (index: number, imageUrl: string) => {
        const updated = [...localMarkers];
        updated[index] = { ...updated[index], image: imageUrl };
        
        // Немедленное обновление локального состояния
        setLocalMarkers(updated);
        
        // Обновление родительского компонента
        debouncedMarkersChange(updated);
    };

    const handleMarkerRemove = (index: number) => {
        const removed = localMarkers[index];
        const removedImage = typeof removed?.image === 'string' ? removed.image.trim() : '';
        if (removedImage && /^(blob:)/i.test(removedImage)) {
            removePendingImageFile(removedImage);
            try {
                URL.revokeObjectURL(removedImage);
            } catch {
                // noop
            }
        }
        const updated = localMarkers.filter((_: any, i: any) => i !== index);
        debouncedMarkersChange(updated);

        if (removed.country) {
            const removedId = String(removed.country);
            const stillExists = updated.some((m: any) => String(m.country) === removedId);
            if (!stillExists) onCountryDeselect(removedId);
        }

        if (editingIndex === index) setEditingIndex(null);
    };

    const styles = useMemo(() => createWebMapStyles(colors), [colors]);

    if (!L || !rl || !markerIcon) {
        return <div style={loadingStyle(colors)}>Загрузка карты…</div>;
    }

    const MapContainer: any = (rl as any).MapContainer;
    const TileLayer: any = (rl as any).TileLayer;
    const Marker: any = (rl as any).Marker;
    const Popup: any = (rl as any).Popup;
    const useMap: any = (rl as any).useMap;
    const useMapEvents: any = (rl as any).useMapEvents;

    return (
        <div
            className="metravel-webmap"
            ref={rootRef}
            style={{
                padding: DESIGN_TOKENS.spacing.xxs,
                width: '100%',
                boxSizing: 'border-box',
            }}
        >
            <style>{buildLeafletPopupCss(colors)}</style>
            <div style={isWideLayout ? styles.splitLayout : undefined}>
                <div style={isWideLayout ? styles.mapPane : undefined}>
                    <div style={isWideLayout ? styles.mapCard : undefined}>
                        <div style={!isWideLayout ? styles.mobileMapShell : undefined}>
                            {!isWideLayout && (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    style={styles.mobileToggleButton}
                                    type="button"
                                >
                                    {isExpanded
                                        ? `Скрыть точки (${localMarkers.length})`
                                        : `Точки (${localMarkers.length})`}
                                </button>
                            )}

                            <MapContainer
                                center={[51.505, -0.09]}
                                zoom={13}
                                keyboard={false}
                                key={mapInstanceKeyRef.current}
                                whenCreated={(map: any) => {
                                    mapRef.current = map;
                                    setMapCreatedNonce((n) => n + 1);
                                }}
                                style={mapHeightStyle(isWideLayout)}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapClickHandler addMarker={addMarker} useMapEventsHook={useMapEvents} />
                                <FitBounds
                                    markers={localMarkers}
                                    initialFitAllowed={hasInitialMarkersRef.current}
                                    useMapHook={useMap}
                                    L={L}
                                />
                                <CenterOnActive
                                    activeIndex={activeIndex}
                                    markers={localMarkers}
                                    useMapHook={useMap}
                                    activeSetByMarkerClickRef={activeSetByMarkerClickRef}
                                />
                                {localMarkers
                                    .filter(hasValidMarkerCoordinates)
                                    .map((marker: any, idx: number) => (
                                    <Marker
                                        key={idx}
                                        position={[marker.lat, marker.lng]}
                                        icon={markerIcon}
                                        eventHandlers={{
                                            click: () => {
                                                activeSetByMarkerClickRef.current = true;
                                                setActiveIndex(idx);
                                                setIsExpanded(true);
                                            },
                                        }}
                                    >
                                        <Popup>
                                            <WebMapMarkerPopup
                                                marker={marker}
                                                markerIndex={idx}
                                                categoryTravelAddress={categoryTravelAddress}
                                                colors={colors}
                                                onEdit={handleEditMarker}
                                                onRemove={handleMarkerRemove}
                                            />
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>

                            {!isWideLayout && isExpanded && (
                                <div style={styles.mobileSheet}>
                                    <div style={styles.mobileSheetHandleRow}>
                                        <div style={styles.mobileSheetHandle} />
                                    </div>
                                    <div style={styles.mobileSheetHeader}>
                                        <div style={styles.mobileSheetTitle}>Точки</div>
                                        <button
                                            type="button"
                                            onClick={() => setIsExpanded(false)}
                                            style={styles.mobileSheetClose}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div id="markers-scroll-container" style={styles.mobileSheetBody}>
                                        <MarkersListComponent
                                            markers={localMarkers}
                                            categoryTravelAddress={categoryTravelAddress}
                                            handleMarkerChange={handleMarkerChange}
                                            handleImageUpload={handleImageUpload}
                                            handleMarkerSave={handleMarkerSave}
                                            handleMarkerRemove={handleMarkerRemove}
                                            editingIndex={editingIndex}
                                            setEditingIndex={setEditingIndex}
                                            activeIndex={activeIndex}
                                            setActiveIndex={setActiveIndex}
                                            onAddMarkerFromPhoto={handleAddMarkerFromPhoto}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div
                    id="markers-list-root"
                    style={isWideLayout ? styles.listPane : { marginTop: DESIGN_TOKENS.spacing.lg }}
                >
                    {isWideLayout ? (
                        <div id="markers-scroll-container" style={styles.listScrollArea}>
                            <MarkersListComponent
                                markers={localMarkers}
                                categoryTravelAddress={categoryTravelAddress}
                                handleMarkerChange={handleMarkerChange}
                                handleImageUpload={handleImageUpload}
                                handleMarkerSave={handleMarkerSave}
                                handleMarkerRemove={handleMarkerRemove}
                                editingIndex={editingIndex}
                                setEditingIndex={setEditingIndex}
                                activeIndex={activeIndex}
                                setActiveIndex={setActiveIndex}
                                onAddMarkerFromPhoto={handleAddMarkerFromPhoto}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};


export default React.memo(WebMapComponent);
