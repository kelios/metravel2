import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MarkersListComponent from '@/components/map/MarkersListComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

// Leaflet/react-leaflet через Metro (без CDN)
import Leaflet from 'leaflet';
import * as ReactLeaflet from 'react-leaflet';
import '@/utils/leafletFix';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { ensureLeafletCss } from '@/utils/ensureLeafletCss';
import { extractGpsFromImageFile } from '@/utils/exifGps';
import { showToast } from '@/utils/toast';
import { uploadImage } from '@/api/misc';
import { getPendingImageFile, registerPendingImageFile, removePendingImageFile } from '@/utils/pendingImageFiles';

const normalizeImageUrl = (url?: string | null) => normalizeMediaUrl(url);

type LeafletNS = any;
type ReactLeafletNS = typeof import('react-leaflet');

async function showToastMessage(payload: any) {
    await showToast(payload);
}

const reverseGeocode = async (latlng: any) => {
    // Пробуем несколько сервисов для получения наиболее точного адреса
    
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

const normalizeCountryString = (value?: string | null) =>
    (value || '')
        .toLowerCase()
        .replace(/[.,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const matchCountryId = (
    countryName: string,
    countrylist: any[],
    countryCode?: string | null,
): number | null => {
    const normalizedCode = (countryCode || '').toString().trim().toUpperCase();
    if (normalizedCode) {
        const byCode = countrylist.find((c: any) => {
            const candidates = [
                c?.code,
                c?.country_code,
                c?.countryCode,
                c?.iso2,
                c?.iso,
                c?.alpha2,
                c?.alpha_2,
            ]
                .map((v: any) => (v == null ? '' : String(v).trim().toUpperCase()))
                .filter(Boolean);
            return candidates.includes(normalizedCode);
        });
        if (byCode?.country_id != null) {
            const num = Number(byCode.country_id);
            if (Number.isFinite(num)) return num;
        }
    }

    const target = normalizeCountryString(countryName);
    if (!target) return null;

    const found = countrylist.find((c: any) => {
        const candidates = [
            c?.title_ru,
            c?.title_en,
            c?.title,
            c?.name,
        ]
            .map(normalizeCountryString)
            .filter(Boolean);

        return candidates.some((candidate: string) => {
            if (!candidate) return false;
            return target === candidate || target.includes(candidate) || candidate.includes(target);
        });
    });

    if (found?.country_id != null) {
        const num = Number(found.country_id);
        return Number.isFinite(num) ? num : null;
    }
    return null;
};

export const buildAddressFromGeocode = (
    geocodeData: any,
    latlng: any,
    matchedCountry?: any,
) => {
    const parts: string[] = [];

    // Извлекаем POI (точка интереса) - важное название места
    const poi = 
        geocodeData?.name ||
        geocodeData?.address?.name ||
        geocodeData?.address?.tourism ||
        geocodeData?.address?.amenity ||
        geocodeData?.address?.historic ||
        geocodeData?.address?.leisure ||
        geocodeData?.address?.place_of_worship ||
        geocodeData?.address?.building;

    // BigDataCloud использует другую структуру данных
    const road = geocodeData?.address?.road || geocodeData?.locality;
    const house = geocodeData?.address?.house_number;
    const streetLine = [road, house].filter(Boolean).join(' ');

    const city =
        geocodeData?.city ||
        geocodeData?.address?.city ||
        geocodeData?.address?.town ||
        geocodeData?.address?.village ||
        geocodeData?.address?.municipality ||
        geocodeData?.address?.suburb ||
        geocodeData?.localityInfo?.locality?.[0]?.name;

    const adminRegion =
        geocodeData?.principalSubdivision ||
        geocodeData?.address?.state ||
        geocodeData?.address?.region ||
        geocodeData?.localityInfo?.administrative?.find((item: any) => item?.order === 2)?.name;

    const adminArea =
        geocodeData?.address?.county ||
        geocodeData?.localityInfo?.administrative?.find((item: any) => item?.order === 4)?.name;

    const countryLabel =
        matchedCountry?.title_ru ||
        matchedCountry?.title ||
        geocodeData?.countryName ||
        geocodeData?.address?.country ||
        '';

    // Добавляем компоненты в порядке: POI → улица → город → регион → область → страна
    // Избегаем дублирования
    if (poi && poi !== city && poi !== road) parts.push(poi);
    if (streetLine && streetLine !== city && streetLine !== poi) parts.push(streetLine);
    if (city) parts.push(city);
    if (adminRegion && adminRegion !== countryLabel && adminRegion !== city) parts.push(adminRegion);
    if (adminArea && adminArea !== adminRegion && adminArea !== countryLabel && adminArea !== city) parts.push(adminArea);
    if (countryLabel) parts.push(countryLabel);

    console.info('Address parts:', parts);

    const separator = ' · ';
    const combined = parts.filter(Boolean).join(separator);
    if (combined) return combined;

    // Финальный fallback - display_name или координаты
    if (geocodeData?.display_name) {
        const displayName = String(geocodeData.display_name)
            .replace(/,\s*/g, ' · ')
            .trim();
        if (displayName) return displayName;
    }
    return `${latlng.lat}, ${latlng.lng}`;
};

type WebMapComponentProps = {
    markers: any[];
    onMarkersChange: (markers: any[]) => void;
    categoryTravelAddress: any[];
    countrylist: any[];
    onCountrySelect: (countryId: any) => void;
    onCountryDeselect: (countryId: any) => void;
    onRequestSaveDraft?: () => Promise<any> | void;
};

const WebMapComponent = ({
    markers,
    onMarkersChange,
    categoryTravelAddress,
    countrylist,
    onCountrySelect,
    onCountryDeselect,
    onRequestSaveDraft,
}: WebMapComponentProps) => {
    // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
    const colors = useThemedColors();

    const [L, setL] = useState<LeafletNS | null>(null);
    const [rl, setRl] = useState<ReactLeafletNS | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let cancelled = false;

        try {
            ensureLeafletCss();
            if (!cancelled) {
                setL(Leaflet);
                setRl(ReactLeaflet as any);
            }
        } catch {
            if (!cancelled) {
                setL(null);
                setRl(null);
            }
        }

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
                    // Сохраняем локальное blob/data превью только если внешний маркер не имеет изображения.
                    if (localMarker?.image && /^(blob:|data:)/i.test(String(localMarker.image))) {
                        const serverImage = m?.image;
                        if (!serverImage || String(serverImage).trim().length === 0) {
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

    const markerIcon = useMemo(() => {
        if (!L) return null;
        return new (L as any).Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
            iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [0, -41],
            shadowSize: [41, 41],
            shadowAnchor: [12, 41],
        });
    }, [L]);

    const addMarker = async (latlng: any, options?: { image?: string | null }) => {
        if (!isValidCoordinates(latlng)) return;

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
    };

    const lastSaveKickAtRef = useRef(0);
    const kickDraftSave = useCallback(() => {
        if (!onRequestSaveDraft) return;
        const now = Date.now();
        if (now - lastSaveKickAtRef.current < 1500) return;
        lastSaveKickAtRef.current = now;
        setTimeout(() => {
            try {
                const res = onRequestSaveDraft();
                if (res && typeof (res as any).catch === 'function') {
                    (res as any).catch(() => null);
                }
            } catch {
                // ignore
            }
        }, 0);
    }, [onRequestSaveDraft]);

    const uploadStateByBlobRef = useRef(new Map<string, { inFlight: boolean; attempts: number; lastToastAt?: number }>());

    const tryUploadMarkerImage = useCallback(async (marker: any) => {
        const imageUrl = typeof marker?.image === 'string' ? marker.image.trim() : '';
        if (!imageUrl || !/^(blob:)/i.test(imageUrl)) return;
        if (marker?.id == null) return;

        const state = uploadStateByBlobRef.current.get(imageUrl) ?? { inFlight: false, attempts: 0 };
        if (state.inFlight || state.attempts >= 3) return;

        const file = getPendingImageFile(imageUrl);
        if (!file) return;

        uploadStateByBlobRef.current.set(imageUrl, { ...state, inFlight: true, attempts: state.attempts + 1 });

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('collection', 'travelImageAddress');
            formData.append('id', String(marker.id));

            const response = await uploadImage(formData);
            const uploadedUrlRaw = response?.url || response?.data?.url || response?.path || response?.file_url;
            const uploadedUrl = uploadedUrlRaw ? normalizeImageUrl(uploadedUrlRaw) : '';
            if (!uploadedUrl) {
                throw new Error('Upload did not return URL');
            }

            const base = Array.isArray(lastMarkersRef.current) ? lastMarkersRef.current : localMarkers;
            const updated = (base || []).map((m: any) => {
                if (String(m?.id ?? '') === String(marker.id) && String(m?.image || '').trim() === imageUrl) {
                    return { ...m, image: uploadedUrl };
                }
                return m;
            });
            debouncedMarkersChange(updated);

            removePendingImageFile(imageUrl);
            try {
                URL.revokeObjectURL(imageUrl);
            } catch {
                // noop
            }
        } catch {
            const now = Date.now();
            const current = uploadStateByBlobRef.current.get(imageUrl) ?? { inFlight: false, attempts: state.attempts + 1 };
            const lastToastAt = current.lastToastAt ?? 0;
            const shouldToast = now - lastToastAt > 8000;
            uploadStateByBlobRef.current.set(imageUrl, { ...current, inFlight: false, lastToastAt: shouldToast ? now : lastToastAt });
            if (shouldToast) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось загрузить фото точки',
                    text2: 'Фото останется локальным до следующей попытки. Проверьте интернет и попробуйте позже.',
                });
            }
        } finally {
            const cur = uploadStateByBlobRef.current.get(imageUrl);
            if (cur) {
                uploadStateByBlobRef.current.set(imageUrl, { ...cur, inFlight: false });
            }
        }
    }, [debouncedMarkersChange, localMarkers]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        (localMarkers || []).forEach((m: any) => {
            void tryUploadMarkerImage(m);
        });
    }, [localMarkers, tryUploadMarkerImage]);

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

        await addMarker({ lat: coords.lat, lng: coords.lng }, { image: previewUrl });
        kickDraftSave();
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

    // ✅ УЛУЧШЕНИЕ: динамические стили с поддержкой тем
    const styles = useMemo(() => ({
        splitLayout: {
            display: 'flex',
            flexDirection: 'row' as const,
            gap: '16px',
            alignItems: 'flex-start' as const,
            width: '100%',
            boxSizing: 'border-box' as const,
        },
        mapPane: {
            flex: '1 1 60%',
            minWidth: 0,
            boxSizing: 'border-box' as const,
        },
        listPane: {
            flex: '0 0 420px',
            maxWidth: '420px',
            border: `1px solid ${colors.border}`,
            borderRadius: `${DESIGN_TOKENS.radii.md}px`,
            padding: `${DESIGN_TOKENS.spacing.md}px`,
            height: '600px',
            overflow: 'hidden' as const,
            backgroundColor: colors.backgroundSecondary,
            boxShadow: DESIGN_TOKENS.shadows.card,
            boxSizing: 'border-box' as const,
        },
        listScrollArea: {
            height: '100%',
            overflowY: 'auto' as const,
            paddingRight: '6px',
        },
        mapCard: {
            border: `1px solid ${colors.border}`,
            borderRadius: `${DESIGN_TOKENS.radii.md}px`,
            overflow: 'hidden' as const,
            backgroundColor: colors.surface,
            boxShadow: DESIGN_TOKENS.shadows.card,
        },
        popupContent: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '8px',
            width: '240px',
            color: colors.text,
        },
        popupImageWrap: {
            width: '100%',
            height: '120px',
            borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
            backgroundColor: colors.backgroundSecondary,
            overflow: 'hidden' as const,
        },
        popupButtons: {
            display: 'flex',
            justifyContent: 'space-between' as const,
            gap: '8px',
        },
        editButton: {
            backgroundColor: colors.primary,
            color: colors.textInverse,
            border: 'none',
            padding: '6px 12px',
            borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
            cursor: 'pointer',
        },
        deleteButton: {
            backgroundColor: colors.danger,
            color: colors.textInverse,
            border: 'none',
            padding: '6px 12px',
            borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
            cursor: 'pointer',
        },
        toggleButton: {
            padding: '8px 16px',
            backgroundColor: colors.primary,
            color: colors.textInverse,
            border: 'none',
            borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
            cursor: 'pointer',
            marginBottom: '8px',
            fontWeight: 'bold' as const,
            fontSize: '14px',
        },
        mobileMapShell: {
            position: 'relative' as const,
        },
        mobileToggleButton: {
            position: 'absolute' as const,
            zIndex: 1001,
            top: '10px',
            right: '10px',
            padding: '8px 12px',
            backgroundColor: colors.primary,
            color: colors.textInverse,
            border: 'none',
            borderRadius: `${DESIGN_TOKENS.radii.pill}px`,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            boxShadow: DESIGN_TOKENS.shadows.hover,
        },
        mobileSheet: {
            position: 'absolute' as const,
            zIndex: 1002,
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '72%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: `${DESIGN_TOKENS.radii.lg}px`,
            borderTopRightRadius: `${DESIGN_TOKENS.radii.lg}px`,
            borderTop: `1px solid ${colors.border}`,
            boxShadow: DESIGN_TOKENS.shadows.modal,
            overflow: 'hidden' as const,
        },
        mobileSheetHandleRow: {
            display: 'flex',
            justifyContent: 'center' as const,
            paddingTop: '8px',
            paddingBottom: '6px',
        },
        mobileSheetHandle: {
            width: '44px',
            height: '4px',
            borderRadius: '999px',
            backgroundColor: colors.border,
        },
        mobileSheetHeader: {
            display: 'flex',
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            padding: '10px 12px',
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
        },
        mobileSheetTitle: {
            fontSize: '14px',
            fontWeight: 800,
            color: colors.text,
        },
        mobileSheetClose: {
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: '18px',
            padding: '4px 6px',
            color: colors.textMuted,
        },
        mobileSheetBody: {
            overflowY: 'auto' as const,
            WebkitOverflowScrolling: 'touch' as const,
            padding: '10px 10px 18px',
            maxHeight: 'calc(72vh - 52px)',
        },
    }), [colors]);

    if (!L || !rl || !markerIcon) {
        return (
            <div style={{ padding: DESIGN_TOKENS.spacing.lg, color: colors.textMuted }}>
                Загрузка карты…
            </div>
        );
    }

    const MapContainer: any = (rl as any).MapContainer;
    const TileLayer: any = (rl as any).TileLayer;
    const Marker: any = (rl as any).Marker;
    const Popup: any = (rl as any).Popup;
    const useMap: any = (rl as any).useMap;
    const useMapEvents: any = (rl as any).useMapEvents;

    // ✅ FIX: Используем ref для отслеживания предыдущего activeIndex, чтобы не центрировать карту повторно
    const CenterOnActive = ({ activeIndex, markers }: { activeIndex: number | null; markers: any[] }) => {
        const map = useMap();
        const prevActiveIndexRef = useRef<number | null>(null);
        const hasCenteredRef = useRef<Set<string>>(new Set());

        useEffect(() => {
            if (activeIndex == null) return;

            // If the active marker was chosen by clicking the marker on the map,
            // Leaflet will already open the popup at the correct location. Extra setView
            // here causes a visible "jerk" (autoPan + setView animate).
            if (activeSetByMarkerClickRef.current) {
                activeSetByMarkerClickRef.current = false;
                prevActiveIndexRef.current = activeIndex;
                return;
            }
            
            // ✅ FIX: Центрируем только если activeIndex изменился И мы еще не центрировались на этом маркере
            if (prevActiveIndexRef.current === activeIndex) return;
            
            const marker = markers[activeIndex];
            if (!marker) return;
            const lat = Number(marker.lat);
            const lng = Number(marker.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

            prevActiveIndexRef.current = activeIndex;
            
            // ✅ FIX: Центрируем только один раз для каждого нового маркера
            const markerKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            if (hasCenteredRef.current.has(markerKey)) return;
            hasCenteredRef.current.add(markerKey);

            const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 13;
            const nextZoom = Math.max(currentZoom, 14);
            map.setView([lat, lng], nextZoom, { animate: true });
        }, [activeIndex, markers, map]);

        return null;
    };

    const FitBounds = ({ markers, initialFitAllowed }: { markers: any[]; initialFitAllowed: boolean }) => {
        const map = useMap();
        const hasFit = useRef(false);

        useEffect(() => {
            if (!initialFitAllowed) return;
            if (!hasFit.current && markers.length > 0) {
                // Фильтруем маркеры с валидными координатами
                const validMarkers = markers.filter((m: any) =>
                    Number.isFinite(m.lat) &&
                    Number.isFinite(m.lng) &&
                    m.lat >= -90 && m.lat <= 90 &&
                    m.lng >= -180 && m.lng <= 180
                );

                if (validMarkers.length === 0) return;

                const bounds = (L as any).latLngBounds(validMarkers.map((m: any) => [m.lat, m.lng]));
                if (!bounds.isValid()) return;

                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
                hasFit.current = true;
            }
        }, [markers, map, initialFitAllowed]);

        return null;
    };

    const MapClickHandler = ({ addMarker }: { addMarker: (latlng: any) => void }) => {
        useMapEvents({
            click(e: any) {
                addMarker(e.latlng);
            },
        });
        return null;
    };


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
            <style>
                {`
                .metravel-webmap .leaflet-popup-content-wrapper,
                .metravel-webmap .leaflet-popup-tip {
                  background: ${colors.surface} !important;
                  opacity: 1 !important;
                }
                .metravel-webmap .leaflet-popup-content-wrapper {
                  color: ${colors.text} !important;
                  border-radius: ${DESIGN_TOKENS.radii.lg}px !important;
                  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08) !important;
                  border: 1px solid ${colors.border} !important;
                  padding: ${DESIGN_TOKENS.spacing.md}px !important;
                }
                .metravel-webmap .leaflet-popup-content {
                  margin: 0 !important;
                  color: ${colors.text} !important;
                  width: 320px !important;
                  max-width: calc(100vw - 60px) !important;
                }
                @media (max-width: 640px) {
                  .metravel-webmap .leaflet-popup-content {
                    width: min(300px, calc(100vw - 40px)) !important;
                  }
                }
                .metravel-webmap .leaflet-popup-close-button {
                  display: block !important;
                  width: 28px !important;
                  height: 28px !important;
                  line-height: 26px !important;
                  text-align: center !important;
                  border-radius: 999px !important;
                  border: 1px solid ${colors.border} !important;
                  background: ${colors.surface} !important;
                  top: 8px !important;
                  right: 8px !important;
                  color: ${colors.textMuted} !important;
                  font-size: 18px !important;
                  transition: all 0.2s !important;
                }
                .metravel-webmap .leaflet-popup-close-button:hover {
                  color: ${colors.text} !important;
                  background: ${colors.backgroundSecondary} !important;
                  transform: scale(1.05) !important;
                }
                `}
            </style>
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
                                style={{ height: isWideLayout ? 600 : 460, width: '100%' }}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapClickHandler addMarker={addMarker} />
                                <FitBounds markers={localMarkers} initialFitAllowed={hasInitialMarkersRef.current} />
                                <CenterOnActive activeIndex={activeIndex} markers={localMarkers} />
                                {localMarkers
                                    .filter((marker: any) =>
                                        Number.isFinite(marker.lat) &&
                                        Number.isFinite(marker.lng) &&
                                        marker.lat >= -90 && marker.lat <= 90 &&
                                        marker.lng >= -180 && marker.lng <= 180
                                    )
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
                                            <div style={{
                                                width: '100%',
                                                maxWidth: 320,
                                                padding: 0,
                                            }}>
                                                {marker.image && (
                                                    <div style={{
                                                        width: '100%',
                                                        height: 160,
                                                        borderRadius: DESIGN_TOKENS.radii.md,
                                                        overflow: 'hidden',
                                                        marginBottom: DESIGN_TOKENS.spacing.sm,
                                                        backgroundColor: colors.backgroundSecondary,
                                                    }}>
                                                        <ImageCardMedia
                                                            src={normalizeImageUrl(marker.image)}
                                                            alt="Фото"
                                                            fit="contain"
                                                            blurBackground
                                                            loading="lazy"
                                                            priority="low"
                                                            borderRadius={DESIGN_TOKENS.radii.md}
                                                            style={{ width: '100%', height: '100%' } as any}
                                                        />
                                                    </div>
                                                )}
                                                
                                                <div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: DESIGN_TOKENS.spacing.sm,
                                                }}>
                                                    {marker.address && (
                                                        <div style={{
                                                            fontSize: 14,
                                                            fontWeight: 600,
                                                            color: colors.text,
                                                            lineHeight: 1.4,
                                                        }}>
                                                            {marker.address}
                                                        </div>
                                                    )}
                                                    
                                                    {marker.categories.length > 0 && (
                                                        <div style={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: 6,
                                                        }}>
                                                            {marker.categories
                                                                .map((catId: any) => {
                                                                    const targetId = String(catId);
                                                                    const found = categoryTravelAddress.find((c: any) => String(c.id) === targetId);
                                                                    return found?.name ?? null;
                                                                })
                                                                .filter(Boolean)
                                                                .map((name: string, i: number) => (
                                                                    <div
                                                                        key={i}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            padding: '4px 10px',
                                                                            borderRadius: 999,
                                                                            backgroundColor: colors.backgroundTertiary,
                                                                            border: `1px solid ${colors.border}`,
                                                                            fontSize: 11,
                                                                            fontWeight: 600,
                                                                            color: colors.textMuted,
                                                                        }}
                                                                    >
                                                                        {name}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                    
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: 8,
                                                        marginTop: 4,
                                                    }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditMarker(idx);
                                                            }}
                                                            style={{
                                                                flex: 1,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 6,
                                                                padding: '8px 12px',
                                                                borderRadius: DESIGN_TOKENS.radii.sm,
                                                                border: `1px solid ${colors.border}`,
                                                                backgroundColor: colors.surface,
                                                                color: colors.text,
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = colors.surface;
                                                            }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                            Редактировать
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkerRemove(idx);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '8px 12px',
                                                                borderRadius: DESIGN_TOKENS.radii.sm,
                                                                border: `1px solid ${colors.border}`,
                                                                backgroundColor: colors.surface,
                                                                color: colors.textMuted,
                                                                fontSize: 13,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = colors.dangerSoft;
                                                                e.currentTarget.style.borderColor = colors.danger;
                                                                e.currentTarget.style.color = colors.danger;
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = colors.surface;
                                                                e.currentTarget.style.borderColor = colors.border;
                                                                e.currentTarget.style.color = colors.textMuted;
                                                            }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
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


export default WebMapComponent;
