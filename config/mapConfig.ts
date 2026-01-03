// Конфигурация карт для MeTravel
// Используем OpenStreetMap (бесплатный) вместо Google Maps

export const MAP_CONFIG = {
  // OpenStreetMap tile server (бесплатный)
  tileServer: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },

  // Альтернативные tile серверы (на случай если основной недоступен)
  alternativeTileServers: [
    {
      name: 'OpenStreetMap HOT',
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team',
    },
    {
      name: 'CartoDB Voyager',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  ],

  // Routing сервис - OpenRouteService (бесплатный)
  routing: {
    service: 'openrouteservice',
    apiUrl: 'https://api.openrouteservice.org/v2/directions',
    // API Key берется из переменных окружения или EAS Secrets
    // Получить бесплатно: https://openrouteservice.org/dev/#/signup
    apiKeyEnvVar: 'EXPO_PUBLIC_ROUTE_SERVICE_KEY',
  },

  // Geocoding сервис - Nominatim (бесплатный, OpenStreetMap)
  geocoding: {
    service: 'nominatim',
    apiUrl: 'https://nominatim.openstreetmap.org',
    searchUrl: 'https://nominatim.openstreetmap.org/search',
    reverseUrl: 'https://nominatim.openstreetmap.org/reverse',
    // Рекомендации по использованию Nominatim:
    // 1. Максимум 1 запрос в секунду
    // 2. Указывать User-Agent
    userAgent: 'MeTravel/1.0 (https://metravel.by)',
  },

  // Настройки по умолчанию
  defaultCenter: {
    latitude: 53.9045, // Минск
    longitude: 27.5615,
  },

  defaultZoom: 13,

  // Настройки для react-native-maps (работает без Google Maps API)
  reactNativeMaps: {
    provider: null, // null = использовать нативные карты платформы (Apple Maps на iOS, Google Maps на Android без API key)
    showsUserLocation: true,
    showsMyLocationButton: true,
    followsUserLocation: false,
  },
};

// Для использования в компонентах:
// import { MAP_CONFIG } from '@/config/mapConfig';

