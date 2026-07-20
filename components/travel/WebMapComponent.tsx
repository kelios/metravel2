import React, { useEffect, useRef, useState, useCallback, useMemo, useId } from 'react';
import MarkersListComponent from '@/components/map/MarkersListComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { ensureLeafletCss } from '@/utils/ensureLeafletCss';
import { extractGpsFromImageFile } from '@/utils/exifGps';
import { showToastMessage } from '@/utils/toast';
import { registerPendingImageFile, removePendingImageFile, getPendingImageFile } from '@/utils/pendingImageFiles';
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload';
import { matchCountryId, buildAddressFromGeocode } from '@/utils/geocodeHelpers';
import { fetchReverseGeocode } from '@/api/geoQueries';
import { bigDataCloudReverse } from '@/api/external/bigdatacloud';
import { buildLeafletPopupCss, createWebMapStyles } from '@/components/travel/WebMapComponent.styles';
import WebMapMarkerPopup from '@/components/travel/WebMapMarkerPopup';
// #992 — общий web-движок карты: MapContainer + единый OSM tile-провайдер.
import MapCanvas from '@/components/MapPage/Map/MapCanvas';
import MapControls from '@/components/MapPage/Map/MapControls';
import type { LatLng } from '@/types/coordinates';
import {
    CenterOnActive,
    FitBounds,
    MapClickHandler,
    createMarkerIcon,
    hasValidMarkerCoordinates,
    loadingStyle,
    mapHeightStyle,
} from '@/components/travel/WebMapLeafletLayers';
import { DEFAULT_LOCALE, i18n, translate as i18nT } from '@/i18n'


type LeafletNS = any;
type ReactLeafletNS = typeof import('react-leaflet');

const reverseGeocode = async (latlng: any) => {
    // Пробуем несколько сервисов для получения наиболее точного адреса.
    // Этот шаг нужен и на web: точка из фото должна сначала получить адрес/страну,
    // затем сохраниться, и только после выдачи backend id можно грузить фото точки.

    // 1. Nominatim с zoom=18 для максимальной детализации (через слой React Query)
    try {
        const data = await fetchReverseGeocode(Number(latlng.lat), Number(latlng.lng));
        // Если есть конкретное название места, используем Nominatim
        if (data) {
            return data;
        }
    } catch (error) {
        console.warn('Nominatim geocoding failed:', error);
    }

    // 2. BigDataCloud как fallback
    try {
        const bigdata = await bigDataCloudReverse(
            Number(latlng.lat),
            Number(latlng.lng),
            i18n.resolvedLanguage || DEFAULT_LOCALE,
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
    onMarkerAdded?: (payload: { markers: any[]; derivedCountryId: number | null }) => Promise<void> | void;
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
    onMarkerAdded,
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
                const { loadLeafletRuntime } = await import('@/utils/loadLeafletRuntime');
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
    // Стартуем с детерминированного значения (как на сервере, где window нет),
    // иначе первый клиентский рендер разойдётся с SSR-HTML → React #418.
    // Реальную раскладку выставляет useEffect ниже сразу после маунта.
    const [isWideLayout, setIsWideLayout] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    // useId детерминирован между SSR и клиентом — Math.random() здесь давал разный
    // key на сервере и клиенте, ломая гидрацию контейнера карты.
    const reactId = useId();
    const mapInstanceKeyRef = useRef<string>(`leaflet-map-${reactId.replace(/:/g, '')}`);
    const [mapCreatedNonce, setMapCreatedNonce] = useState(0);
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    // #992 — стабильный колбэк для MapCanvas.onMapRef: lifecycle-эффект движка
    // зависит от него, инлайн-стрелка перезапускала бы эффект каждый рендер.
    const handleMapRef = useCallback((map: any) => {
        if (!map || mapRef.current === map) return;
        mapRef.current = map;
        setMapCreatedNonce((n) => n + 1);
    }, []);

    const centerOnLocation = useCallback((location: LatLng) => {
        const map = mapRef.current;
        if (!map) return;
        const currentZoom = Number(map.getZoom?.());
        const targetZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 15) : 15;
        map.setView?.([location.lat, location.lng], targetZoom, { animate: true });
    }, []);

    const handleCenterUserLocation = useCallback(() => {
        if (userLocation) {
            centerOnLocation(userLocation);
            return;
        }

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('map:hooks.map.useMapCoordinates.ne_udalos_opredelit_mestopolozhenie_ad63da94'),
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                setUserLocation(location);
                centerOnLocation(location);
            },
            () => {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('map:hooks.map.useMapCoordinates.ne_udalos_opredelit_mestopolozhenie_ad63da94'),
                });
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
        );
    }, [centerOnLocation, userLocation]);

    const handleZoomIn = useCallback(() => mapRef.current?.zoomIn?.(), []);
    const handleZoomOut = useCallback(() => mapRef.current?.zoomOut?.(), []);

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
    // Ссылка на массив markers (prop) на момент внутреннего апдейта.
    // Нужна, чтобы отличать внутренний апдейт от наложившегося внешнего.
    const internalUpdateMarkersRef = useRef<any[]>(markers);
    const prevExternalLengthRef = useRef<number>(markers.length);
    const activeSetByMarkerClickRef = useRef(false);
    
    // Синхронизируем локальное состояние с пропсами только при внешних изменениях
    useEffect(() => {
        // Пропускаем обновление, только если оно было инициировано внутри компонента
        // И ссылка markers не изменилась с момента внутреннего апдейта.
        // Если markers пришёл другой ссылкой — это реальное внешнее обновление,
        // которое нельзя проглатывать.
        if (isInternalUpdateRef.current) {
            isInternalUpdateRef.current = false;
            if (markers === internalUpdateMarkersRef.current) {
                return;
            }
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
        // Запоминаем текущую ссылку prop markers: эффект синхронизации проглотит
        // апдейт только если markers не сменился внешне с этого момента.
        internalUpdateMarkersRef.current = markers;
        setLocalMarkers(updatedMarkers);
        onMarkersChange(updatedMarkers);
        lastMarkersRef.current = updatedMarkers;
    }, [markers, onMarkersChange]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            setIsWideLayout(window.innerWidth >= 1024);
        };

        handleResize();
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

    const addMarker = async (
        latlng: any,
        options?: { image?: string | null; notifyAdded?: boolean },
    ) => {
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

        // Клик по карте добавляет точку без категории/фото и не открывает явный save —
        // триггерим немедленное сохранение, чтобы перезагрузка страницы не теряла точку
        // (тикет #505). Для точки из фото save идёт отдельно через onPhotoMarkerReady,
        // поэтому там notifyAdded=false (не дублируем сохранение).
        if (options?.notifyAdded !== false) {
            try {
                await onMarkerAdded?.({ markers: nextMarkers, derivedCountryId });
            } catch {
                // Save может упасть на модерационной валидации обязательных полей точки.
                // Точка уже в стейте — пользователь дозаполнит и сохранит снова.
            }
        }

        return { nextMarkers, derivedCountryId };
    };

    const handleAddMarkerFromPhoto = async (file: File) => {
        if (typeof window === 'undefined') return;
        if (typeof File === 'undefined' || !(file instanceof File)) return;

        const coords = await extractGpsFromImageFile(file);
        if (!coords) {
            void showToastMessage({
                type: 'info',
                text1: i18nT('travel:components.travel.WebMapComponent.u_foto_net_koordinat_53dd76a3'),
                text2: i18nT('travel:components.travel.WebMapComponent.v_etom_snimke_net_gps_v_exif_poetomu_tochka__99b155e2'),
                visibilityTime: 7000,
            });
            return;
        }

        let previewUrl: string | null = null;
        try {
            const uploadableFile = await prepareWebImageFileForUpload(file);
            previewUrl = URL.createObjectURL(uploadableFile);
            registerPendingImageFile(previewUrl, uploadableFile);
        } catch {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.WebMapComponent.ne_udalos_obrabotat_foto_598d7bae'),
                text2: i18nT('travel:components.travel.WebMapComponent.poprobuyte_jpg_ili_png_esli_heic_ne_udalos_p_55f5d6dd'),
            });
            return;
        }

        const markerResult = await addMarker(
            { lat: coords.lat, lng: coords.lng },
            { image: previewUrl, notifyAdded: false },
        );
        if (!markerResult) return;

        try {
            await onPhotoMarkerReady?.({
                markers: markerResult.nextMarkers,
                derivedCountryId: markerResult.derivedCountryId,
            });
        } catch {
            // Сейв маршрута мог упасть (напр. модерационная валидация categories у только что
            // добавленной точки). Точка уже в локальном стейте — НЕ ревокаем preview-blob и НЕ
            // удаляем pending-файл: иначе objectURL становится мёртвым (naturalWidth:0) и миниатюра
            // серая. Blob безопасно ревокать только после успешной загрузки (useMarkerImageUpload)
            // или при явном удалении точки. Пользователь добавит категории — следующий сейв пройдёт.
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.WebMapComponent.tochka_dobavlena_no_ne_sohranena_fa36d5a3'),
                text2: i18nT('travel:components.travel.WebMapComponent.zapolnite_obyazatelnye_polya_tochki_naprimer_cf782264'),
            });
            return;
        }

        void showToastMessage({
            type: 'success',
            text1: i18nT('travel:components.travel.WebMapComponent.tochka_dobavlena_09df6a33'),
            text2: i18nT('travel:components.travel.WebMapComponent.koordinaty_vzyaty_iz_geolokatsii_foto_exif_e5caf133'),
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

    const handleReorder = useCallback(
        (fromIndex: number, toIndex: number) => {
            const current = localMarkers;
            if (
                fromIndex === toIndex ||
                fromIndex < 0 ||
                toIndex < 0 ||
                fromIndex >= current.length ||
                toIndex >= current.length
            ) {
                return;
            }
            const updated = [...current];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(toIndex, 0, moved);

            debouncedMarkersChange(updated);
            // Тот же путь персиста, что и правка точки (onMarkerEditSave),
            // чтобы новый порядок сохранился на backend.
            void onMarkerEditSave?.(updated);

            // Держим активную/редактируемую точку на том же маркере после сдвига.
            const remap = (prev: number | null): number | null => {
                if (prev == null) return prev;
                if (prev === fromIndex) return toIndex;
                if (fromIndex < prev && toIndex >= prev) return prev - 1;
                if (fromIndex > prev && toIndex <= prev) return prev + 1;
                return prev;
            };
            setActiveIndex((prev) => remap(prev));
            setEditingIndex((prev) => remap(prev));
        },
        [localMarkers, debouncedMarkersChange, onMarkerEditSave],
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
        if (!removed) return;
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

        if (removed?.country) {
            const removedId = String(removed.country);
            const stillExists = updated.some((m: any) => String(m.country) === removedId);
            if (!stillExists) onCountryDeselect(removedId);
        }

        if (editingIndex === index) setEditingIndex(null);
    };

    const styles = useMemo(() => createWebMapStyles(colors), [colors]);

    if (!L || !rl || !markerIcon) {
        return <div style={loadingStyle(colors)}>{i18nT('travel:components.travel.WebMapComponent.zagruzka_karty_c6c52f38')}</div>;
    }

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
                                        ? i18nT('travel:components.travel.WebMapComponent.skryt_tochki_value1_918e3c69', { value1: localMarkers.length })
                                        : i18nT('travel:components.travel.WebMapComponent.pokazat_tochki_value1_fb4db4b2', { value1: localMarkers.length })}
                                </button>
                            )}

                            {/* #992 — wizard-карта на общем web-движке MapCanvas: MapContainer +
                                единый tile-провайдер живут в движке; экран отдаёт свой уже
                                загруженный engine (собственный loader/loading-UX сохранён) и
                                предметных детей через render-prop. Собственный invalidateSize-
                                эффект экрана (mapCreatedNonce/isWideLayout/isExpanded) сохранён —
                                resizeTrigger движка не используется, чтобы не дублировать. */}
                            <MapCanvas
                                center={[51.505, -0.09]}
                                zoom={13}
                                zoomControl={false}
                                keyboard={false}
                                containerKey={mapInstanceKeyRef.current}
                                engine={{ L: L as any, RL: rl as any }}
                                onMapRef={handleMapRef}
                                mapStyle={mapHeightStyle(isWideLayout)}
                            >
                              {() => (
                                <>
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
                                    .map((marker: any, originalIdx: number) => ({ marker, originalIdx }))
                                    .filter(({ marker }) => hasValidMarkerCoordinates(marker))
                                    .map(({ marker, originalIdx }) => (
                                    <Marker
                                        key={marker.id ?? `${marker.lat},${marker.lng}`}
                                        position={[marker.lat, marker.lng]}
                                        icon={markerIcon}
                                        eventHandlers={{
                                            click: () => {
                                                activeSetByMarkerClickRef.current = true;
                                                setActiveIndex(originalIdx);
                                                setIsExpanded(true);
                                            },
                                        }}
                                    >
                                        <Popup
                                            className="metravel-place-popup"
                                            closeButton={false}
                                            autoPan
                                        >
                                            <WebMapMarkerPopup
                                                marker={marker}
                                                markerIndex={originalIdx}
                                                categoryTravelAddress={categoryTravelAddress}
                                                colors={colors}
                                                onEdit={handleEditMarker}
                                                onRemove={handleMarkerRemove}
                                                onClose={() => mapRef.current?.closePopup?.()}
                                            />
                                        </Popup>
                                    </Marker>
                                ))}
                                </>
                              )}
                            </MapCanvas>
                            <MapControls
                                userLocation={userLocation}
                                onCenterUserLocation={handleCenterUserLocation}
                                onZoomIn={handleZoomIn}
                                onZoomOut={handleZoomOut}
                                alignLeft
                                topOffset={16}
                                zIndex={1000}
                            />

                        </div>
                    </div>
                </div>

                <div
                    id="markers-list-panel"
                    style={isWideLayout ? styles.listPane : (isExpanded ? styles.mobileListPanel : { marginTop: DESIGN_TOKENS.spacing.lg })}
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
                                onReorder={handleReorder}
                            />
                        </div>
                    ) : isExpanded ? (
                        <div id="markers-scroll-container" style={styles.mobileListBody}>
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
                                onReorder={handleReorder}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};


export default React.memo(WebMapComponent);
