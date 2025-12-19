import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
// CSS загружается через CDN в Map.web.tsx
import MarkersListComponent from '../MarkersListComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type LeafletNS = any;
type ReactLeafletNS = typeof import('react-leaflet');

const reverseGeocode = async (latlng: any) => {
    const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&addressdetails=1`
    );
    return await response.json();
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
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
    
    // Debounced обновление родительского компонента
    const debouncedMarkersChange = useCallback((updatedMarkers: any[]) => {
        // Обновляем локальное состояние немедленно для UI
        setLocalMarkers(updatedMarkers);
        
        // Отменяем предыдущий таймер
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        
        // Увеличен debounce до 1000ms для синхронизации с UpsertTravel
        updateTimeoutRef.current = setTimeout(() => {
            onMarkersChange(updatedMarkers);
            lastMarkersRef.current = updatedMarkers;
        }, 1000);
    }, [onMarkersChange]);
    
    // Cleanup при размонтировании
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

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
        const address = geocodeData?.display_name || '';
        const country = geocodeData?.address?.country || '';

        const newMarker = {
            id: null,
            lat: latlng.lat,
            lng: latlng.lng,
            address,
            categories: [],
            image: null,
            country: null,
        };

        if (country) {
            const foundCountry = countrylist.find((c: any) => c.title_ru === country);
            if (foundCountry) {
                newMarker.country = foundCountry.country_id;
                onCountrySelect(foundCountry.country_id);
            }
        }

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
        const updated = [...localMarkers];
        updated[index].image = imageUrl;
        debouncedMarkersChange(updated);
    };

    const handleMarkerRemove = (index: number) => {
        const removed = localMarkers[index];
        const updated = localMarkers.filter((_: any, i: any) => i !== index);
        debouncedMarkersChange(updated);

        if (removed.country) {
            const stillExists = updated.some((m: any) => m.country === removed.country);
            if (!stillExists) onCountryDeselect(removed.country);
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
                                                    <img src={marker.image} alt="Фото" style={styles.popupImage} />
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
