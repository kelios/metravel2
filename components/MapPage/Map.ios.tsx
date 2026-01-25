import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useThemedColors } from '@/hooks/useTheme';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';

type Point = {
  id: number;
  lat: string;
  lng: string;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
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

const withAlpha = (color: string, alpha: number) => {
  if (!color || color.startsWith('rgba') || color.startsWith('rgb')) {
    return color;
  }

  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return `#${hex}${alphaHex}`;
  }

  return color;
};

const Map: React.FC<TravelProps> = ({ travel, coordinates: propCoordinates }) => {
  const travelAddress = useMemo(() => travel?.travelAddress?.data || [], [travel?.travelAddress?.data]);
  const [localCoordinates, setLocalCoordinates] = useState<Coordinates | null>(propCoordinates);
  const [isLoading, setIsLoading] = useState(true);
  const themeColors = useThemedColors();
  const { getSiteBaseUrl } = require('@/utils/seo');

  useEffect(() => {
    if (!localCoordinates) {
      setLocalCoordinates({ latitude: 53.8828449, longitude: 27.7273595 });
    }
  }, [localCoordinates]);

  const centerLat = localCoordinates?.latitude ?? 53.8828449;
  const centerLng = localCoordinates?.longitude ?? 27.7273595;
  const loaderOverlay = useMemo(
    () => withAlpha(themeColors.surface, 0.8),
    [themeColors.surface]
  );
  const markerColor = themeColors.primary;
  const markerInnerColor = themeColors.textOnDark;
  const markerSvg = `
    <svg width="32" height="48" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="${markerColor}"/>
      <circle cx="16" cy="16" r="10" fill="${markerInnerColor}"/>
      <path d="M24 32C20 40 16 48 16 48C16 48 12 40 8 32H24Z" fill="${markerColor}"/>
    </svg>
  `;
  const markerSvgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(markerSvg)}`;

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
        .leaflet-popup-content-wrapper { background-color: ${themeColors.surface}; border-radius: 8px; padding: 0; }
        .leaflet-popup-content { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
        .popup-image { 
          width: 200px; 
          height: 150px; 
          object-fit: cover; 
          border-radius: 8px 8px 0 0; 
          display: block;
        }
        .popup-image-link {
          display: block;
          text-decoration: none;
        }
        .popup-text { padding: 12px; font-size: 13px; line-height: 1.5; }
        .popup-label { font-weight: 600; color: ${themeColors.text}; margin-top: 8px; margin-bottom: 4px; }
        .popup-label:first-of-type { margin-top: 0; }
        .popup-value { color: ${themeColors.textMuted}; font-size: 12px; margin-bottom: 4px; }
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

        function sendOpenUrl(rawUrl) {
          try {
            if (!rawUrl) return;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_URL', url: rawUrl }));
            }
          } catch {
            // noop
          }
        }

        // Создаем иконку маркера
        const markerIcon = L.icon({
          iconUrl: '${markerSvgUrl}',
          iconSize: [32, 48],
          iconAnchor: [16, 48],
          popupAnchor: [0, -48]
        });

        points.forEach((point, index) => {
          if (!point.coord) return;
          const [lat, lng] = point.coord.split(',').map(Number);
          
          let popupContent = '';
          if (point.travelImageThumbUrl) {
            const link = (point.articleUrl || point.urlTravel || '');
            popupContent += '<a href="#" class="popup-image-link" data-open-url="' + String(link).replace(/"/g, '&quot;') + '">' +
              '<img src="' + point.travelImageThumbUrl + '" class="popup-image" alt="' + (point.address || 'Image') + '" />' +
            '</a>';
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

          marker.on('popupopen', function(e) {
            try {
              const popupEl = e && e.popup ? e.popup.getElement() : null;
              if (!popupEl) return;
              const linkEl = popupEl.querySelector('.popup-image-link');
              if (!linkEl) return;
              linkEl.addEventListener('click', function(ev) {
                try {
                  ev.preventDefault();
                  const url = (linkEl.getAttribute('data-open-url') || '').trim();
                  if (!url) return;
                  sendOpenUrl(url);
                } catch {
                  // noop
                }
              }, { once: true });
            } catch {
              // noop
            }
          });

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
    <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
      {isLoading && (
        <View style={[styles.loader, { backgroundColor: loaderOverlay }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      )}
      <WebView
        source={{ html: htmlContent }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadEnd={() => setIsLoading(false)}
        onMessage={async (event) => {
          const raw = String(event?.nativeEvent?.data ?? '');
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.type !== 'OPEN_URL') return;
            const safeUrl = getSafeExternalUrl(parsed?.url, { allowRelative: true, baseUrl: getSiteBaseUrl() });
            if (!safeUrl) return;
            const can = await Linking.canOpenURL(safeUrl);
            if (can) {
              await Linking.openURL(safeUrl);
            }
          } catch {
            // noop
          }
        }}
        scrollEnabled={true}
        pinchZoomEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    minHeight: 300,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

export default Map;
