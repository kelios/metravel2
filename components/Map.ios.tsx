import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

type Point = {
  id: number;
  lat: string;
  lng: string;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
};

type PaginatedResponse = {
  current_page: number;
  data: Point[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
};

type TravelPropsType = {
  travelAddress: PaginatedResponse;
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface TravelProps {
  travel: TravelPropsType;
  coordinates: Coordinates | null;
}

const getLatLng = (coord: string) => {
  const [latitude, longitude] = coord.split(',').map(Number);
  return { latitude, longitude };
};

const Map: React.FC<TravelProps> = ({ travel, coordinates: propCoordinates }) => {
  const travelAddress = useMemo(() => travel?.travelAddress?.data || [], [travel?.travelAddress]);
  const [localCoordinates, setLocalCoordinates] = useState<Coordinates | null>(propCoordinates);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!localCoordinates) {
      setLocalCoordinates({ latitude: 53.8828449, longitude: 27.7273595 });
    }
  }, [localCoordinates]);

  const centerLat = localCoordinates?.latitude ?? 53.8828449;
  const centerLng = localCoordinates?.longitude ?? 27.7273595;

  // Генерируем HTML для Leaflet карты (OpenStreetMap - бесплатно)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; }
        #map { width: 100%; height: 100%; }
        .leaflet-popup-content { font-size: 12px; max-width: 200px; }
        .popup-image { width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 10);
        
        // OpenStreetMap (бесплатно, без ключей!)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Маркеры для всех точек
        const points = ${JSON.stringify(travelAddress)};
        const bounds = L.latLngBounds();

        points.forEach((point, index) => {
          if (!point.coord) return;
          const [lat, lng] = point.coord.split(',').map(Number);
          
          const marker = L.marker([lat, lng]).addTo(map);
          
          let popupContent = '<div style="padding: 10px;">';
          
          if (point.travelImageThumbUrl) {
            popupContent += '<img src="' + point.travelImageThumbUrl + '" class="popup-image" />';
          }
          
          popupContent += '<div style="font-weight: bold; margin-bottom: 5px;">Адрес:</div>';
          popupContent += '<div style="margin-bottom: 10px;">' + (point.address || 'Нет адреса') + '</div>';
          
          popupContent += '<div style="font-weight: bold; margin-bottom: 5px;">Координаты:</div>';
          popupContent += '<div style="margin-bottom: 10px;">' + point.coord + '</div>';
          
          popupContent += '<div style="font-weight: bold; margin-bottom: 5px;">Категория:</div>';
          popupContent += '<div>' + (point.categoryName || 'Не указана') + '</div>';
          popupContent += '</div>';
          
          marker.bindPopup(popupContent);
          bounds.extend([lat, lng]);
        });

        // Автоматически подогнать карту под все маркеры
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ff7f50" />
        </View>
      )}
      <WebView
        source={{ html: htmlContent }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadEnd={() => setIsLoading(false)}
        scrollEnabled={true}
        pinchZoomEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 10,
  },
});

export default Map;
