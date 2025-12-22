import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MarkersListComponent from '../MarkersListComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const normalizeImageUrl = (url?: string | null) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return trimmed;
    const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
    return `${base}/${trimmed.replace(/^\/+/, '')}`;
};

type LeafletNS = any;
type ReactLeafletNS = typeof import('react-leaflet');

const reverseGeocode = async (latlng: any) => {
    // Use a CORS-friendly provider first, then fall back to Nominatim
    try {
        const primary = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latlng.lat}&longitude=${latlng.lng}&localityLanguage=ru`
        );
        if (primary.ok) {
            const data = await primary.json();
            console.log('BigDataCloud geocode response:', data);
            return data;
        }
    } catch {
        // ignore and fall back
    }

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&addressdetails=1&accept-language=ru&extratags=1&namedetails=1`
        );
        if (!response.ok) return null;
        const data = await response.json();
        console.log('Nominatim geocode response:', data);
        return data;
    } catch {
        // Network/parse errors: let caller fallback to empty address
        return null;
    }
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
    console.log('buildAddressFromGeocode called with:', { geocodeData, latlng, matchedCountry });
    
    // Если display_name есть, попробуем построить адрес из частей, чтобы добавить регион и страну
    // display_name используем как финальный fallback
    const parts: string[] = [];

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

    // Добавляем компоненты, избегая дублирования
    if (streetLine && streetLine !== city) parts.push(streetLine);
    if (city) parts.push(city);
    if (adminRegion && adminRegion !== countryLabel) parts.push(adminRegion);
    if (adminArea && adminArea !== adminRegion && adminArea !== countryLabel) parts.push(adminArea);
    if (countryLabel) parts.push(countryLabel);

    console.log('Address parts:', parts);

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
    travelId?: any;
};

const WebMapComponent = ({
    markers,
    onMarkersChange,
    categoryTravelAddress,
    countrylist,
    onCountrySelect,
    onCountryDeselect,
    travelId,
}: WebMapComponentProps) => {
    const [L, setL] = useState<LeafletNS | null>(null);
    const [rl, setRl] = useState<ReactLeafletNS | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (typeof window === 'undefined') return;

        const ensureLeafletCSS = () => {
            const href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            if (!document.querySelector(`link[href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                // avoid setting indexed props on style list; append normally
                document.head.appendChild(link);
            }
        };

        const ensureLeaflet = async (): Promise<any> => {
            const w = window as any;
            if (w.L) return w.L;

            ensureLeafletCSS();

            if (!(ensureLeaflet as any)._loader) {
                (ensureLeaflet as any)._loader = new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                    script.async = true;
                    script.onload = () => resolve();
                    script.onerror = (err) => {
                        (ensureLeaflet as any)._loader = null;
                        reject(err);
                    };
                    document.body.appendChild(script);
                });
            }

            await (ensureLeaflet as any)._loader;
            return w.L;
        };

        const load = async () => {
            try {
                const L = await ensureLeaflet();
                const rlMod = await import('react-leaflet');
                if (!cancelled) {
                    setL(L);
                    setRl(rlMod);
                }
            } catch {
                if (!cancelled) {
                    setL(null);
                    setRl(null);
                }
            }
        };

        load();

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
    
    // Локальное состояние маркеров для немедленного отображения изменений
    const [localMarkers, setLocalMarkers] = useState(markers);
    const lastMarkersRef = useRef(markers);
    
    // Синхронизируем локальное состояние с пропсами только при реальных изменениях
    useEffect(() => {
        // Проверяем, действительно ли маркеры изменились (по длине и первому элементу)
        const markersChanged = 
            markers.length !== lastMarkersRef.current.length ||
            (markers.length > 0 && lastMarkersRef.current.length > 0 && 
             markers[0] !== lastMarkersRef.current[0]);
        
        if (markersChanged) {
            setLocalMarkers(markers);
            lastMarkersRef.current = markers;
        }
    }, [markers]);
    
    // Немедленное обновление родительского компонента (без дебаунса)
    const debouncedMarkersChange = useCallback((updatedMarkers: any[]) => {
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

    const addMarker = async (latlng: any) => {
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

        const matchedId = country ? matchCountryId(country, countrylist, countryCode) : null;
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
            image: null,
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

        debouncedMarkersChange([...localMarkers, newMarker]);
        setActiveIndex(localMarkers.length);
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
        console.log('handleImageUpload called:', { index, imageUrl });
        const updated = [...localMarkers];
        updated[index] = { ...updated[index], image: imageUrl };
        console.log('Updated marker:', updated[index]);
        
        // Немедленное обновление локального состояния
        setLocalMarkers(updated);
        
        // Обновление родительского компонента
        debouncedMarkersChange(updated);
    };

    const handleMarkerRemove = (index: number) => {
        const removed = localMarkers[index];
        const updated = localMarkers.filter((_: any, i: any) => i !== index);
        debouncedMarkersChange(updated);

        if (removed.country) {
            const removedId = String(removed.country);
            const stillExists = updated.some((m: any) => String(m.country) === removedId);
            if (!stillExists) onCountryDeselect(removedId);
        }

        if (editingIndex === index) setEditingIndex(null);
    };

    if (!L || !rl || !markerIcon) {
        return (
            <div style={{ padding: DESIGN_TOKENS.spacing.lg, color: DESIGN_TOKENS.colors.textMuted }}>
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

    const FitBounds = ({ markers }: { markers: any[] }) => {
        const map = useMap();
        const hasFit = useRef(false);

        useEffect(() => {
            if (!hasFit.current && markers.length > 0) {
                const bounds = (L as any).latLngBounds(markers.map((m: any) => [m.lat, m.lng]));
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
                hasFit.current = true;
            }
        }, [markers, map]);

        return null;
    };

    const MapClickHandler = ({ addMarker }: { addMarker: (latlng: any) => void }) => {
        useMapEvents({
            click(e: any) {
                addMarker(e.latlng);
            }
        });
        return null;
    };

    return (
        <div style={{ padding: DESIGN_TOKENS.spacing.xxs }}>
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
                                style={{ height: isWideLayout ? 600 : 460, width: '100%' }}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapClickHandler addMarker={addMarker} />
                                <FitBounds markers={localMarkers} />
                                {localMarkers.map((marker: any, idx: number) => (
                                    <Marker
                                        key={idx}
                                        position={[marker.lat, marker.lng]}
                                        icon={markerIcon}
                                        eventHandlers={{
                                            click: () => {
                                                setActiveIndex(idx);
                                                setIsExpanded(true);
                                            },
                                        }}
                                    >
                                        <Popup>
                                            <div style={styles.popupContent}>
                                                {marker.image && (
                                                    <img src={normalizeImageUrl(marker.image)} alt="Фото" style={styles.popupImage} />
                                                )}
                                                <p><strong>Адрес:</strong> {marker.address || 'Не указан'}</p>
                                                <p><strong>Категории:</strong>
                                                    {marker.categories.length > 0
                                                        ? marker.categories
                                                            .map((catId: any) => {
                                                                const found = categoryTravelAddress.find((c: any) => c.id === catId);
                                                                return found ? found.name : `ID: ${catId}`;
                                                            })
                                                            .join(', ')
                                                        : 'Не выбрано'}
                                                </p>
                                                <div style={styles.popupButtons}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditMarker(idx);
                                                        }}
                                                        style={styles.editButton}
                                                    >
                                                        Редактировать
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMarkerRemove(idx);
                                                        }}
                                                        style={styles.deleteButton}
                                                    >
                                                        Удалить
                                                    </button>
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
                                    <div style={styles.mobileSheetBody}>
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
                                            travelId={travelId}
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
                        <div style={styles.listScrollArea}>
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
                                travelId={travelId}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const styles: any = {
    splitLayout: {
        display: 'flex',
        flexDirection: 'row',
        gap: '16px',
        alignItems: 'flex-start',
    },
    mapPane: {
        flex: '1 1 60%',
        minWidth: 0,
    },
    listPane: {
        flex: '0 0 420px',
        maxWidth: '420px',
        border: `1px solid ${DESIGN_TOKENS.colors.border}`,
        borderRadius: `${DESIGN_TOKENS.radii.md}px`,
        padding: `${DESIGN_TOKENS.spacing.md}px`,
        height: '600px',
        overflow: 'hidden',
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        boxShadow: DESIGN_TOKENS.shadows.card,
    },
    listScrollArea: {
        height: '100%',
        overflowY: 'auto',
        paddingRight: '6px',
    },
    mapCard: {
        border: `1px solid ${DESIGN_TOKENS.colors.border}`,
        borderRadius: `${DESIGN_TOKENS.radii.md}px`,
        overflow: 'hidden',
        backgroundColor: DESIGN_TOKENS.colors.surface,
        boxShadow: DESIGN_TOKENS.shadows.card,
    },
    popupContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '240px',
    },
    popupImage: {
        width: '100%',
        height: '120px',
        objectFit: 'cover',
        borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    },
    popupButtons: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
    },
    editButton: {
        backgroundColor: DESIGN_TOKENS.colors.primary,
        color: DESIGN_TOKENS.colors.textInverse,
        border: 'none',
        padding: '6px 12px',
        borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
        cursor: 'pointer',
    },
    deleteButton: {
        backgroundColor: DESIGN_TOKENS.colors.danger,
        color: DESIGN_TOKENS.colors.textInverse,
        border: 'none',
        padding: '6px 12px',
        borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
        cursor: 'pointer',
    },
    toggleButton: {
        padding: '8px 16px',
        backgroundColor: DESIGN_TOKENS.colors.primary,
        color: DESIGN_TOKENS.colors.textInverse,
        border: 'none',
        borderRadius: `${DESIGN_TOKENS.radii.sm}px`,
        cursor: 'pointer',
        marginBottom: '8px',
        fontWeight: 'bold',
        fontSize: '14px',
    },
    mobileMapShell: {
        position: 'relative',
    },
    mobileToggleButton: {
        position: 'absolute',
        zIndex: 1001,
        top: '10px',
        right: '10px',
        padding: '8px 12px',
        backgroundColor: DESIGN_TOKENS.colors.primary,
        color: DESIGN_TOKENS.colors.textInverse,
        border: 'none',
        borderRadius: `${DESIGN_TOKENS.radii.pill}px`,
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '13px',
        boxShadow: DESIGN_TOKENS.shadows.hover,
    },
    mobileSheet: {
        position: 'absolute',
        zIndex: 1002,
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '72%',
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderTopLeftRadius: `${DESIGN_TOKENS.radii.lg}px`,
        borderTopRightRadius: `${DESIGN_TOKENS.radii.lg}px`,
        borderTop: `1px solid ${DESIGN_TOKENS.colors.border}`,
        boxShadow: DESIGN_TOKENS.shadows.modal,
        overflow: 'hidden',
    },
    mobileSheetHandleRow: {
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '8px',
        paddingBottom: '6px',
    },
    mobileSheetHandle: {
        width: '44px',
        height: '4px',
        borderRadius: '999px',
        backgroundColor: DESIGN_TOKENS.colors.border,
    },
    mobileSheetHeader: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`,
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    mobileSheetTitle: {
        fontSize: '14px',
        fontWeight: 800,
        color: DESIGN_TOKENS.colors.text,
    },
    mobileSheetClose: {
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        fontSize: '18px',
        lineHeight: '18px',
        padding: '4px 6px',
        color: DESIGN_TOKENS.colors.textMuted,
    },
    mobileSheetBody: {
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '10px 10px 18px',
        maxHeight: 'calc(72vh - 52px)',
    },
};

export default WebMapComponent;
