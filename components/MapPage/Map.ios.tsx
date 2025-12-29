import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
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
  const travelAddress = useMemo(() => travel?.travelAddress?.data || [], [travel?.travelAddress?.data]);
  const [localCoordinates, setLocalCoordinates] = useState<Coordinates | null>(propCoordinates);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!localCoordinates) {
      setLocalCoordinates({ latitude: 53.8828449, longitude: 27.7273595 });
    }
  }, [localCoordinates]);

  const centerLat = localCoordinates?.latitude ?? 53.8828449;
  const centerLng = localCoordinates?.longitude ?? 27.7273595;

  // HTML с улучшенными маркерами (поддержка фото в попапе)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; }
        #map { width: 100%; height: 100%; }
        .leaflet-popup-content-wrapper { background-color: #fff; border-radius: 8px; padding: 0; }
        .leaflet-popup-content { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
        .popup-image { 
          width: 200px; 
          height: 150px; 
          object-fit: cover; 
          border-radius: 8px 8px 0 0; 
          display: block;
        }
        .popup-text { padding: 12px; font-size: 13px; line-height: 1.5; }
        .popup-label { font-weight: 600; color: #333; margin-top: 8px; margin-bottom: 4px; }
        .popup-label:first-of-type { margin-top: 0; }
        .popup-value { color: #666; font-size: 12px; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 10);
        
        // OpenStreetMap (бесплатно!)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        }).addTo(map);

        const points = ${JSON.stringify(travelAddress)};
        const bounds = L.latLngBounds();

        // Создаем иконку маркера
        const markerIcon = L.icon({
          iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCAzMiA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iI2ZmN2Y1MCIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjEwIiBmaWxsPSIjZmZmZmZmIi8+PHBhdGggZD0iTTI0IDMyQzIwIDQwIDE2IDQ4IDE2IDQ4QzE2IDQ4IDEyIDQwIDggMzJIMjRaIiBmaWxsPSIjZmY3ZjUwIi8+PC9zdmc+',
          iconSize: [32, 48],
          iconAnchor: [16, 48],
          popupAnchor: [0, -48]
        });

        points.forEach((point, index) => {
          if (!point.coord) return;
          const [lat, lng] = point.coord.split(',').map(Number);
          
          let popupContent = '';
          if (point.travelImageThumbUrl) {
            popupContent += '<img src="' + point.travelImageThumbUrl + '" class="popup-image" alt="' + (point.address || 'Image') + '" />';
          }
          
          popupContent += '<div class="popup-text">';
          popupContent += '<div class="popup-label">Адрес:</div>';
          popupContent += '<div class="popup-value">' + (point.address || 'Не указан') + '</div>';
          
          popupContent += '<div class="popup-label">Координаты:</div>';
          popupContent += '<div class="popup-value">' + point.coord + '</div>';
          
          popupContent += '<div class="popup-label">Категория:</div>';
          popupContent += '<div class="popup-value">' + (point.categoryName || 'Не указана') + '</div>';
          popupContent += '</div>';
          
          const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
          marker.bindPopup(popupContent, { maxWidth: 200 });
          bounds.extend([lat, lng]);
        });

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
    minHeight: 300,
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
