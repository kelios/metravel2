// components/MapPage/map/useLeafletIcons.ts
import { useMemo } from 'react';

export const useLeafletIcons = (L: any) => {
  return useMemo(() => {
    if (!L || typeof L.Icon !== 'function') return null;

    // Оранжевый маркер для мест путешествий
    const orangeMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
      crossOrigin: true,
    });

    // Зеленый маркер для старта
    const greenMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [30, 41],
      iconAnchor: [15, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });

    // Красный маркер для финиша
    const redMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [30, 41],
      iconAnchor: [15, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });

    // Синий маркер для местоположения пользователя
    const blueMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });

    return {
      meTravel: orangeMarkerIcon,
      userLocation: blueMarkerIcon,
      start: greenMarkerIcon,
      end: redMarkerIcon,
    };
  }, [L]);
};

