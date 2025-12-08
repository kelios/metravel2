import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
// CSS загружается через CDN в Map.web.tsx
import L from 'leaflet';
import MarkersListComponent from '../MarkersListComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Используем стандартный оранжевый маркер Leaflet
const markerIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
    shadowSize: [41, 41],
    shadowAnchor: [12, 41],
});

const FitBounds = ({ markers }) => {
    const map = useMap();
    const hasFit = useRef(false);

    useEffect(() => {
        if (!hasFit.current && markers.length > 0) {
            const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
            hasFit.current = true;
        }
    }, [markers, map]);

    return null;
};

const MapClickHandler = ({ addMarker }) => {
    useMapEvents({
        click(e) {
            addMarker(e.latlng);
        }
    });
    return null;
};

const reverseGeocode = async (latlng) => {
    const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&addressdetails=1`
    );
    return await response.json();
};

const WebMapComponent = ({
                             markers,
                             onMarkersChange,
                             categoryTravelAddress,
                             countrylist,
                             onCountrySelect,
                             onCountryDeselect,
                             travelId,
                         }) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    
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

    const isValidCoordinates = ({ lat, lng }) =>
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    const addMarker = async (latlng) => {
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
            const foundCountry = countrylist.find(c => c.title_ru === country);
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
        const updated = localMarkers.filter((_, i) => i !== index);
        debouncedMarkersChange(updated);

        if (removed.country) {
            const stillExists = updated.some(m => m.country === removed.country);
            if (!stillExists) onCountryDeselect(removed.country);
        }

        if (editingIndex === index) setEditingIndex(null);
    };

    return (
        <div style={{ padding: DESIGN_TOKENS.spacing.xxs0 }}>
            <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: 500 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapClickHandler addMarker={addMarker} />
                <FitBounds markers={localMarkers} />
                {localMarkers.map((marker, idx) => (
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
                                            .map(catId => {
                                                const found = categoryTravelAddress.find(c => c.id === catId);
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

            <div style={{ marginTop: DESIGN_TOKENS.spacing.lg }}>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={styles.toggleButton}
                >
                    {isExpanded ? `Скрыть точки (${markers.length})` : `Показать точки (${markers.length})`}
                </button>

                <div style={{
                    maxHeight: isExpanded ? '500px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease',
                }}>
                    {isExpanded && (
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
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
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
        borderRadius: '6px',
        backgroundColor: '#f0f0f0',
    },
    popupButtons: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
    },
    editButton: {
        backgroundColor: '#4b7c6f',
        color: 'white',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    deleteButton: {
        backgroundColor: '#d9534f',
        color: 'white',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    toggleButton: {
        padding: '8px 16px',
        backgroundColor: '#4b7c6f',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '8px',
        fontWeight: 'bold',
        fontSize: '14px',
    },
};

export default WebMapComponent;
