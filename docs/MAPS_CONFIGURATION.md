# 🗺️ Конфигурация карт без Google Maps

## Используемые решения

MeTravel использует **бесплатные** картографические сервисы:

### 1. **OpenStreetMap** (вместо Google Maps)
- ✅ Полностью бесплатный
- ✅ Открытые данные
- ✅ Нет лимитов на просмотры
- ✅ Работает на всех платформах

### 2. **react-native-maps** (нативные карты)
- **iOS**: использует Apple Maps (встроенные, бесплатно)
- **Android**: использует Google Maps (встроенные в устройство, API key не нужен)
- **Web**: используется react-leaflet с OpenStreetMap

### 3. **OpenRouteService** (маршруты)
- Бесплатный API для построения маршрутов
- Лимит: 2000 запросов/день
- Получить ключ: https://openrouteservice.org/dev/#/signup

### 4. **Nominatim** (поиск мест)
- Бесплатный geocoding от OpenStreetMap
- Лимит: 1 запрос/секунду
- Не требует API key

---

## Настройка

### Шаг 1: Получить OpenRouteService API Key

```bash
# 1. Зарегистрироваться на https://openrouteservice.org/dev/#/signup
# 2. Создать токен в панели управления
# 3. Добавить в EAS Secrets:

eas secret:create --scope project --name ROUTE_SERVICE_KEY --value "YOUR_ORS_KEY"
```

### Шаг 2: Обновить .env файлы

**.env.dev:**
```bash
EXPO_PUBLIC_ROUTE_SERVICE_KEY=your_dev_key_here
```

**.env.prod:**
```bash
# Секрет хранится в EAS Secrets, здесь только комментарий
# ROUTE_SERVICE_KEY настроен через: eas secret:create
```

### Шаг 3: Проверить конфигурацию

Файл `config/mapConfig.ts` содержит все настройки карт:
- Tile servers (OpenStreetMap)
- Routing (OpenRouteService)
- Geocoding (Nominatim)

---

## Использование в коде

### React Native (iOS/Android)

```typescript
import MapView, { Marker } from 'react-native-maps';
import { MAP_CONFIG } from '@/config/mapConfig';

// Используйте нативные карты (Apple Maps на iOS, Google Maps на Android)
<MapView
  provider={MAP_CONFIG.reactNativeMaps.provider} // null = нативные карты
  initialRegion={{
    latitude: MAP_CONFIG.defaultCenter.latitude,
    longitude: MAP_CONFIG.defaultCenter.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }}
  showsUserLocation={true}
>
  <Marker coordinate={{ latitude: 53.9, longitude: 27.56 }} />
</MapView>
```

### Web (Leaflet)

```typescript
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { MAP_CONFIG } from '@/config/mapConfig';

<MapContainer
  center={[MAP_CONFIG.defaultCenter.latitude, MAP_CONFIG.defaultCenter.longitude]}
  zoom={MAP_CONFIG.defaultZoom}
>
  <TileLayer
    url={MAP_CONFIG.tileServer.url}
    attribution={MAP_CONFIG.tileServer.attribution}
    maxZoom={MAP_CONFIG.tileServer.maxZoom}
  />
  <Marker position={[53.9, 27.56]} />
</MapContainer>
```

### Geocoding (поиск мест)

```typescript
import { MAP_CONFIG } from '@/config/mapConfig';

async function searchPlace(query: string) {
  const response = await fetch(
    `${MAP_CONFIG.geocoding.searchUrl}?q=${encodeURIComponent(query)}&format=json`,
    {
      headers: {
        'User-Agent': MAP_CONFIG.geocoding.userAgent,
      },
    }
  );
  return response.json();
}
```

### Routing (маршруты)

```typescript
import { MAP_CONFIG } from '@/config/mapConfig';

async function getRoute(start: [number, number], end: [number, number]) {
  const apiKey = process.env.EXPO_PUBLIC_ROUTE_SERVICE_KEY;
  
  const response = await fetch(
    `${MAP_CONFIG.routing.apiUrl}/driving-car?api_key=${apiKey}&start=${start[1]},${start[0]}&end=${end[1]},${end[0]}`
  );
  return response.json();
}
```

---

## Преимущества решения

✅ **Бесплатно** - никаких API keys для карт  
✅ **Нативные карты** - лучшая производительность на iOS/Android  
✅ **OpenStreetMap** - актуальные данные, community-driven  
✅ **Кроссплатформенность** - работает везде одинаково  
✅ **Без лимитов** - просмотр карт не ограничен  

## Лимиты и best practices

### Nominatim (Geocoding)
- ⚠️ Максимум **1 запрос/секунду**
- ✅ Кэшируйте результаты
- ✅ Используйте debounce для поиска

### OpenRouteService (Routing)
- ⚠️ Бесплатный план: **2000 запросов/день**
- ✅ Кэшируйте маршруты
- ✅ Не стройте маршруты в реальном времени без необходимости

### OpenStreetMap Tiles
- ✅ Без ограничений для просмотра
- ⚠️ Для high-traffic приложений рекомендуется свой tile server

---

## Альтернативы (если нужно больше)

Если бесплатных лимитов недостаточно:

1. **Mapbox** - 50,000 запросов/месяц бесплатно
2. **HERE Maps** - 250,000 транзакций/месяц бесплатно  
3. **TomTom** - 2,500 транзакций/день бесплатно

---

## Troubleshooting

### "Карты не отображаются на Android"
- Проверьте разрешения в app.json (ACCESS_FINE_LOCATION)
- Убедитесь что Google Play Services установлены на устройстве

### "Карты не отображаются на iOS"
- Проверьте NSLocationWhenInUseUsageDescription в app.json
- Убедитесь что пользователь дал разрешение на геолокацию

### "Nominatim возвращает 429 (Too Many Requests)"
- Убедитесь что соблюдается лимит 1 запрос/секунду
- Добавьте задержку между запросами
- Используйте кэширование

---

**См. также:**
- [OpenStreetMap Documentation](https://wiki.openstreetmap.org/wiki/Main_Page)
- [react-native-maps Documentation](https://github.com/react-native-maps/react-native-maps)
- [OpenRouteService API](https://openrouteservice.org/dev/#/api-docs)
- [Nominatim API](https://nominatim.org/release-docs/latest/api/Overview/)

