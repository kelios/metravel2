# Техническое задание: Импорт и управление пользовательскими точками

## 1. Общее описание

### 1.1 Цель
Реализовать функционал импорта пользовательских точек из Google Maps и OpenStreetMap с возможностью категоризации, фильтрации и построения маршрутов.

### 1.2 Бизнес-задачи
- Позволить пользователям импортировать свои сохраненные места из внешних картографических сервисов
- Обеспечить категоризацию точек по цветам и типам (посещенные, планируемые, избранные)
- Предоставить инструменты планирования маршрутов на основе импортированных точек
- Создать систему рекомендаций для выбора точек для посещения

### 1.3 Стек технологий
- **Frontend**: React Native (Expo), TypeScript
- **Backend**: Python (Django/FastAPI) - в разработке
- **Maps**: OpenStreetMap (Leaflet для web), Apple Maps (iOS), Google Maps (Android)
- **State Management**: Zustand, React Query

---

## 2. Функциональные требования

### 2.1 Импорт точек

#### 2.1.1 Поддерживаемые источники
1. **Google Maps**
   - Формат: Google Takeout (JSON/KML)
   - Типы данных: Saved Places, Starred Places, Want to Go
   
2. **OpenStreetMap**
   - Формат: GPX, GeoJSON
   - Типы данных: Bookmarks, Custom POI

#### 2.1.2 Процесс импорта
```typescript
// Шаги импорта
1. Пользователь выбирает источник (Google Maps / OSM)
2. Загружает файл через file picker
3. Система валидирует формат файла
4. Парсинг данных на клиенте
5. Отправка данных на бэкенд для сохранения
6. Отображение импортированных точек на карте
```

#### 2.1.3 Структура импортируемых данных
```typescript
interface ImportedPoint {
  // Основные данные
  id: string;                    // UUID генерируется на клиенте
  name: string;                  // Название точки
  description?: string;          // Описание
  
  // Геолокация
  latitude: number;              // Широта
  longitude: number;             // Долгота
  address?: string;              // Адрес (если доступен)
  
  // Категоризация
  color: PointColor;             // Цвет категории
  category: PointCategory;       // Тип места
  status: PointStatus;           // Статус посещения
  
  // Метаданные
  source: 'google_maps' | 'osm'; // Источник импорта
  originalId?: string;           // ID из источника
  importedAt: string;            // ISO timestamp импорта
  
  // Дополнительные данные
  photos?: string[];             // URL фотографий
  rating?: number;               // Рейтинг (1-5)
  notes?: string;                // Заметки пользователя
  visitedDate?: string;          // Дата посещения
  tags?: string[];               // Теги
}
```

### 2.2 Категоризация точек

#### 2.2.1 Цветовые категории
```typescript
enum PointColor {
  GREEN = 'green',      // Посещенные места
  PURPLE = 'purple',    // Очень хочу посетить
  BROWN = 'brown',      // Другие категории
  BLUE = 'blue',        // Планируемые
  RED = 'red',          // Избранные
  YELLOW = 'yellow',    // В процессе планирования
  GRAY = 'gray'         // Архив/неактуальные
}

// Описание категорий
const COLOR_CATEGORIES = {
  green: {
    label: 'Посещено',
    icon: 'check-circle',
    description: 'Места, где я уже была'
  },
  purple: {
    label: 'Мечта',
    icon: 'star',
    description: 'Очень хочу посетить'
  },
  brown: {
    label: 'Интересное',
    icon: 'map-pin',
    description: 'Интересные места'
  },
  blue: {
    label: 'Планирую',
    icon: 'calendar',
    description: 'В планах на посещение'
  },
  red: {
    label: 'Избранное',
    icon: 'heart',
    description: 'Любимые места'
  },
  yellow: {
    label: 'В работе',
    icon: 'clock',
    description: 'Планирование маршрута'
  },
  gray: {
    label: 'Архив',
    icon: 'archive',
    description: 'Неактуальные места'
  }
};
```

#### 2.2.2 Типы мест (автоопределение)
```typescript
enum PointCategory {
  // Природа
  MOUNTAIN = 'mountain',
  LAKE = 'lake',
  FOREST = 'forest',
  BEACH = 'beach',
  PARK = 'park',
  
  // Архитектура
  CASTLE = 'castle',
  CHURCH = 'church',
  MONUMENT = 'monument',
  MUSEUM = 'museum',
  
  // Инфраструктура
  RESTAURANT = 'restaurant',
  CAFE = 'cafe',
  HOTEL = 'hotel',
  SHOP = 'shop',
  
  // Развлечения
  THEATER = 'theater',
  CINEMA = 'cinema',
  ATTRACTION = 'attraction',
  
  // Прочее
  OTHER = 'other'
}

// Правила автоопределения категории
const CATEGORY_KEYWORDS = {
  mountain: ['гора', 'mountain', 'peak', 'вершина', 'холм'],
  castle: ['замок', 'castle', 'fortress', 'крепость'],
  museum: ['музей', 'museum', 'gallery', 'галерея'],
  restaurant: ['ресторан', 'restaurant', 'кафе', 'cafe'],
  // ... и т.д.
};
```

#### 2.2.3 Статусы посещения
```typescript
enum PointStatus {
  VISITED = 'visited',           // Посещено
  WANT_TO_VISIT = 'want_to_visit', // Хочу посетить
  PLANNING = 'planning',         // Планирую
  ARCHIVED = 'archived'          // Архив
}
```

### 2.3 Фильтрация и отображение

#### 2.3.1 Фильтры
```typescript
interface PointFilters {
  // Основные фильтры
  colors?: PointColor[];         // Фильтр по цветам
  categories?: PointCategory[];  // Фильтр по типам
  statuses?: PointStatus[];      // Фильтр по статусам
  
  // Географические фильтры
  bounds?: {                     // Границы карты
    north: number;
    south: number;
    east: number;
    west: number;
  };
  radius?: {                     // Радиус от точки
    center: { lat: number; lng: number };
    meters: number;
  };
  
  // Текстовый поиск
  search?: string;               // Поиск по названию/описанию
  
  // Временные фильтры
  dateRange?: {
    from?: string;               // Дата от
    to?: string;                 // Дата до
  };
  
  // Сортировка
  sortBy?: 'name' | 'date' | 'distance' | 'rating';
  sortOrder?: 'asc' | 'desc';
}
```

#### 2.3.2 UI компоненты фильтрации
- Чипсы для быстрого выбора цветовых категорий
- Выпадающий список типов мест
- Переключатели статусов
- Слайдер радиуса поиска
- Поисковая строка

### 2.4 Построение маршрутов

#### 2.4.1 Типы маршрутов
```typescript
interface RouteRequest {
  // Начальная точка
  origin: {
    lat: number;
    lng: number;
    label?: string;              // "Мое местоположение" или адрес
  };
  
  // Точки назначения
  destinations: string[];        // ID импортированных точек
  
  // Параметры маршрута
  transportMode: 'car' | 'bike' | 'foot' | 'transit';
  optimize?: boolean;            // Оптимизировать порядок точек
  
  // Ограничения
  maxDistance?: number;          // Максимальная дистанция (км)
  maxDuration?: number;          // Максимальное время (минуты)
  avoidTolls?: boolean;          // Избегать платных дорог
  avoidHighways?: boolean;       // Избегать автострад
}

interface RouteResponse {
  // Маршрут
  route: {
    points: Array<{ lat: number; lng: number }>;
    distance: number;            // Метры
    duration: number;            // Секунды
    steps: RouteStep[];
  };
  
  // Точки маршрута
  waypoints: Array<{
    pointId: string;
    order: number;
    arrivalTime?: string;        // Расчетное время прибытия
    distanceFromPrevious: number;
    durationFromPrevious: number;
  }>;
  
  // Статистика
  stats: {
    totalDistance: number;
    totalDuration: number;
    estimatedCost?: number;      // Если есть платные дороги
  };
}
```

#### 2.4.2 Функции построения маршрута
1. **От текущего местоположения до точки**
   - Показать расстояние и время в пути
   - Выбор транспорта (авто/велосипед/пешком/транспорт)
   
2. **Маршрут через несколько точек**
   - Выбор до 10 точек
   - Автоматическая оптимизация порядка
   - Показ общего времени и расстояния

3. **Круговой маршрут**
   - Начало = конец
   - Оптимизация для минимизации общего расстояния

### 2.5 Рекомендации

#### 2.5.1 "Куда поехать сегодня"
```typescript
interface RecommendationRequest {
  // Параметры запроса
  count: number;                 // Количество рекомендаций (по умолчанию 4)
  maxDistance?: number;          // Максимальное расстояние (км)
  maxDuration?: number;          // Максимальное время в пути (минуты)
  
  // Фильтры
  preferredColors?: PointColor[];
  preferredCategories?: PointCategory[];
  excludeVisited?: boolean;      // Исключить посещенные
  
  // Контекст
  currentLocation?: { lat: number; lng: number };
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  weather?: 'sunny' | 'rainy' | 'cloudy';
}

interface RecommendationResponse {
  recommendations: Array<{
    point: ImportedPoint;
    score: number;               // Оценка релевантности (0-100)
    reasons: string[];           // Причины рекомендации
    distance?: number;           // Расстояние от текущей позиции
    duration?: number;           // Время в пути
  }>;
}
```

#### 2.5.2 Алгоритм рекомендаций
```typescript
// Факторы для расчета score
const RECOMMENDATION_FACTORS = {
  distance: 0.3,        // Близость к текущему местоположению
  status: 0.25,         // Приоритет "хочу посетить"
  category: 0.2,        // Соответствие предпочтениям
  rating: 0.15,         // Рейтинг места
  novelty: 0.1          // Новизна (недавно добавленные)
};
```

---

## 3. API Endpoints (для бэкенда)

### 3.1 Импорт точек
```
POST /api/user-points/import/
Content-Type: multipart/form-data

Request:
{
  "source": "google_maps" | "osm",
  "file": File,
  "userId": string
}

Response: 201 Created
{
  "success": true,
  "imported": number,
  "skipped": number,
  "errors": string[],
  "points": ImportedPoint[]
}
```

### 3.2 CRUD операции с точками

#### 3.2.1 Получить список точек
```
GET /api/user-points/?page=1&perPage=50&filters={...}
Authorization: Token <token>

Response: 200 OK
{
  "data": ImportedPoint[],
  "total": number,
  "page": number,
  "perPage": number
}
```

#### 3.2.2 Создать точку вручную
```
POST /api/user-points/
Authorization: Token <token>
Content-Type: application/json

Request:
{
  "name": string,
  "latitude": number,
  "longitude": number,
  "color": PointColor,
  "category": PointCategory,
  "status": PointStatus,
  ...
}

Response: 201 Created
{
  "point": ImportedPoint
}
```

#### 3.2.3 Обновить точку
```
PATCH /api/user-points/{id}/
Authorization: Token <token>
Content-Type: application/json

Request:
{
  "color"?: PointColor,
  "status"?: PointStatus,
  "notes"?: string,
  ...
}

Response: 200 OK
{
  "point": ImportedPoint
}
```

#### 3.2.4 Удалить точку
```
DELETE /api/user-points/{id}/
Authorization: Token <token>

Response: 204 No Content
```

#### 3.2.5 Массовое обновление
```
PATCH /api/user-points/bulk-update/
Authorization: Token <token>
Content-Type: application/json

Request:
{
  "pointIds": string[],
  "updates": {
    "color"?: PointColor,
    "status"?: PointStatus,
    ...
  }
}

Response: 200 OK
{
  "updated": number,
  "points": ImportedPoint[]
}
```

### 3.3 Построение маршрутов

#### 3.3.1 Расчет маршрута
```
POST /api/user-points/route/calculate/
Authorization: Token <token>
Content-Type: application/json

Request: RouteRequest

Response: 200 OK
RouteResponse
```

#### 3.3.2 Сохранить маршрут
```
POST /api/user-points/route/save/
Authorization: Token <token>
Content-Type: application/json

Request:
{
  "name": string,
  "route": RouteResponse,
  "pointIds": string[]
}

Response: 201 Created
{
  "routeId": string,
  "route": SavedRoute
}
```

#### 3.3.3 Получить сохраненные маршруты
```
GET /api/user-points/routes/
Authorization: Token <token>

Response: 200 OK
{
  "routes": SavedRoute[]
}
```

### 3.4 Рекомендации

```
POST /api/user-points/recommendations/
Authorization: Token <token>
Content-Type: application/json

Request: RecommendationRequest

Response: 200 OK
RecommendationResponse
```

### 3.5 Статистика

```
GET /api/user-points/stats/
Authorization: Token <token>

Response: 200 OK
{
  "total": number,
  "byColor": Record<PointColor, number>,
  "byCategory": Record<PointCategory, number>,
  "byStatus": Record<PointStatus, number>,
  "visited": number,
  "toVisit": number,
  "totalDistance": number,        // Общее расстояние посещенных мест
  "countriesVisited": number,
  "citiesVisited": number
}
```

---

## 4. Frontend архитектура

### 4.1 Структура файлов

```
components/
├── UserPoints/
│   ├── ImportWizard/
│   │   ├── ImportWizard.tsx              # Главный компонент импорта
│   │   ├── SourceSelector.tsx            # Выбор источника (Google/OSM)
│   │   ├── FileUploader.tsx              # Загрузка файла
│   │   ├── DataPreview.tsx               # Предпросмотр данных
│   │   ├── CategoryMapper.tsx            # Маппинг категорий
│   │   └── ImportProgress.tsx            # Прогресс импорта
│   │
│   ├── PointsList/
│   │   ├── PointsList.tsx                # Список точек
│   │   ├── PointCard.tsx                 # Карточка точки
│   │   ├── PointFilters.tsx              # Панель фильтров
│   │   ├── ColorChips.tsx                # Чипсы цветов
│   │   └── SearchBar.tsx                 # Поиск
│   │
│   ├── PointDetails/
│   │   ├── PointDetails.tsx              # Детали точки
│   │   ├── PointEditor.tsx               # Редактор точки
│   │   ├── PhotoGallery.tsx              # Галерея фото
│   │   └── NotesEditor.tsx               # Редактор заметок
│   │
│   ├── RouteBuilder/
│   │   ├── RouteBuilder.tsx              # Построитель маршрутов
│   │   ├── WaypointSelector.tsx          # Выбор точек
│   │   ├── RouteOptions.tsx              # Опции маршрута
│   │   ├── RoutePreview.tsx              # Предпросмотр маршрута
│   │   └── RouteStats.tsx                # Статистика маршрута
│   │
│   ├── Recommendations/
│   │   ├── RecommendationsPanel.tsx      # Панель рекомендаций
│   │   ├── RecommendationCard.tsx        # Карточка рекомендации
│   │   └── RecommendationFilters.tsx     # Фильтры рекомендаций
│   │
│   └── Map/
│       ├── UserPointsLayer.tsx           # Слой точек на карте
│       ├── PointMarker.tsx               # Маркер точки
│       ├── RouteLayer.tsx                # Слой маршрута
│       └── ClusterMarker.tsx             # Кластеризация точек
│
hooks/
├── useUserPoints.ts                      # Хук для работы с точками
├── usePointImport.ts                     # Хук импорта
├── usePointFilters.ts                    # Хук фильтрации
├── useRouteBuilder.ts                    # Хук построения маршрутов
└── useRecommendations.ts                 # Хук рекомендаций

stores/
└── userPointsStore.ts                    # Zustand store для точек

src/api/
├── userPoints.ts                         # API методы для точек
├── routes.ts                             # API методы для маршрутов
└── parsers/
    ├── googleMapsParser.ts               # Парсер Google Maps
    └── osmParser.ts                      # Парсер OSM

utils/
├── pointCategorization.ts                # Автокатегоризация
├── routeOptimization.ts                  # Оптимизация маршрутов
└── distanceCalculation.ts                # Расчет расстояний

types/
└── userPoints.ts                         # TypeScript типы
```

### 4.2 Ключевые компоненты

#### 4.2.1 ImportWizard
```typescript
// components/UserPoints/ImportWizard/ImportWizard.tsx
import React, { useState } from 'react';

type ImportStep = 'source' | 'upload' | 'preview' | 'mapping' | 'progress';

export const ImportWizard: React.FC = () => {
  const [step, setStep] = useState<ImportStep>('source');
  const [source, setSource] = useState<'google_maps' | 'osm' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  
  // Логика импорта...
  
  return (
    <View>
      {step === 'source' && <SourceSelector onSelect={setSource} />}
      {step === 'upload' && <FileUploader onUpload={setFile} />}
      {step === 'preview' && <DataPreview data={parsedData} />}
      {step === 'mapping' && <CategoryMapper data={parsedData} />}
      {step === 'progress' && <ImportProgress />}
    </View>
  );
};
```

#### 4.2.2 PointsList с фильтрами
```typescript
// components/UserPoints/PointsList/PointsList.tsx
import React from 'react';
import { useUserPoints } from '@/hooks/useUserPoints';
import { usePointFilters } from '@/hooks/usePointFilters';

export const PointsList: React.FC = () => {
  const { filters, setFilters } = usePointFilters();
  const { data, isLoading } = useUserPoints(filters);
  
  return (
    <View>
      <PointFilters filters={filters} onChange={setFilters} />
      <FlatList
        data={data?.points}
        renderItem={({ item }) => <PointCard point={item} />}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};
```

#### 4.2.3 RouteBuilder
```typescript
// components/UserPoints/RouteBuilder/RouteBuilder.tsx
import React, { useState } from 'react';
import { useRouteBuilder } from '@/hooks/useRouteBuilder';

export const RouteBuilder: React.FC = () => {
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);
  const [transportMode, setTransportMode] = useState<'car' | 'bike' | 'foot'>('car');
  
  const { calculateRoute, isCalculating, route } = useRouteBuilder();
  
  const handleCalculate = async () => {
    const result = await calculateRoute({
      origin: currentLocation,
      destinations: selectedPoints,
      transportMode,
      optimize: true
    });
  };
  
  return (
    <View>
      <WaypointSelector
        selectedPoints={selectedPoints}
        onSelect={setSelectedPoints}
      />
      <RouteOptions
        transportMode={transportMode}
        onChangeMode={setTransportMode}
      />
      <Button onPress={handleCalculate}>
        Построить маршрут
      </Button>
      {route && <RoutePreview route={route} />}
    </View>
  );
};
```

### 4.3 API клиент (Frontend)

```typescript
// src/api/userPoints.ts
import { apiClient } from './client';
import type { ImportedPoint, PointFilters, RouteRequest, RouteResponse } from '@/types/userPoints';

export const userPointsApi = {
  // Импорт
  async importPoints(source: 'google_maps' | 'osm', file: File) {
    const formData = new FormData();
    formData.append('source', source);
    formData.append('file', file);
    
    return apiClient.uploadFormData<{
      success: boolean;
      imported: number;
      points: ImportedPoint[];
    }>('/user-points/import/', formData, 'POST');
  },
  
  // Получить список точек
  async getPoints(filters?: PointFilters) {
    const params = new URLSearchParams();
    if (filters?.colors) params.append('colors', filters.colors.join(','));
    if (filters?.categories) params.append('categories', filters.categories.join(','));
    if (filters?.search) params.append('search', filters.search);
    
    return apiClient.get<{
      data: ImportedPoint[];
      total: number;
    }>(`/user-points/?${params.toString()}`);
  },
  
  // Создать точку
  async createPoint(point: Partial<ImportedPoint>) {
    return apiClient.post<{ point: ImportedPoint }>('/user-points/', point);
  },
  
  // Обновить точку
  async updatePoint(id: string, updates: Partial<ImportedPoint>) {
    return apiClient.patch<{ point: ImportedPoint }>(`/user-points/${id}/`, updates);
  },
  
  // Удалить точку
  async deletePoint(id: string) {
    return apiClient.delete(`/user-points/${id}/`);
  },
  
  // Построить маршрут
  async calculateRoute(request: RouteRequest) {
    return apiClient.post<RouteResponse>('/user-points/route/calculate/', request);
  },
  
  // Получить рекомендации
  async getRecommendations(count: number = 4, filters?: any) {
    return apiClient.post<{
      recommendations: Array<{
        point: ImportedPoint;
        score: number;
        reasons: string[];
      }>;
    }>('/user-points/recommendations/', { count, ...filters });
  },
  
  // Статистика
  async getStats() {
    return apiClient.get<{
      total: number;
      byColor: Record<string, number>;
      visited: number;
      toVisit: number;
    }>('/user-points/stats/');
  }
};
```

### 4.4 React Query хуки

```typescript
// hooks/useUserPoints.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/src/api/userPoints';
import type { PointFilters, ImportedPoint } from '@/types/userPoints';

export const useUserPoints = (filters?: PointFilters) => {
  return useQuery({
    queryKey: ['userPoints', filters],
    queryFn: () => userPointsApi.getPoints(filters),
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

export const useCreatePoint = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: userPointsApi.createPoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPoints'] });
    },
  });
};

export const useUpdatePoint = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ImportedPoint> }) =>
      userPointsApi.updatePoint(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPoints'] });
    },
  });
};

export const useDeletePoint = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: userPointsApi.deletePoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPoints'] });
    },
  });
};

export const usePointImport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ source, file }: { source: 'google_maps' | 'osm'; file: File }) =>
      userPointsApi.importPoints(source, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPoints'] });
    },
  });
};
```

---

## 5. Парсеры данных

### 5.1 Google Maps Parser

```typescript
// src/api/parsers/googleMapsParser.ts
import type { ImportedPoint, PointColor, PointCategory } from '@/types/userPoints';

export class GoogleMapsParser {
  /**
   * Парсит данные из Google Takeout
   * Поддерживает форматы: JSON, KML
   */
  static async parse(file: File): Promise<ImportedPoint[]> {
    const text = await file.text();
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'json') {
      return this.parseJSON(text);
    } else if (extension === 'kml') {
      return this.parseKML(text);
    }
    
    throw new Error('Неподдерживаемый формат файла');
  }
  
  private static parseJSON(text: string): ImportedPoint[] {
    const data = JSON.parse(text);
    const points: ImportedPoint[] = [];
    
    // Google Takeout структура
    const features = data.features || [];
    
    for (const feature of features) {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      
      if (!coords || coords.length < 2) continue;
      
      const point: ImportedPoint = {
        id: crypto.randomUUID(),
        name: props.Title || props.name || 'Без названия',
        description: props.description,
        latitude: coords[1],
        longitude: coords[0],
        address: props.address,
        color: this.mapGoogleCategoryToColor(props.Category),
        category: this.detectCategory(props.Title, props.description),
        status: this.mapGoogleStatusToStatus(props.Category),
        source: 'google_maps',
        originalId: props['Google Maps URL'],
        importedAt: new Date().toISOString(),
        rating: props.rating,
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static parseKML(text: string): ImportedPoint[] {
    // KML парсинг через DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const placemarks = doc.getElementsByTagName('Placemark');
    const points: ImportedPoint[] = [];
    
    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i];
      const name = placemark.getElementsByTagName('name')[0]?.textContent || 'Без названия';
      const description = placemark.getElementsByTagName('description')[0]?.textContent;
      const coordinates = placemark.getElementsByTagName('coordinates')[0]?.textContent;
      
      if (!coordinates) continue;
      
      const [lng, lat] = coordinates.trim().split(',').map(Number);
      
      const point: ImportedPoint = {
        id: crypto.randomUUID(),
        name,
        description: description || undefined,
        latitude: lat,
        longitude: lng,
        color: 'blue' as PointColor,
        category: this.detectCategory(name, description),
        status: 'want_to_visit',
        source: 'google_maps',
        importedAt: new Date().toISOString(),
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static mapGoogleCategoryToColor(category?: string): PointColor {
    if (!category) return 'blue';
    
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('starred') || lowerCategory.includes('favorite')) {
      return 'red';
    }
    if (lowerCategory.includes('want to go')) {
      return 'purple';
    }
    if (lowerCategory.includes('visited')) {
      return 'green';
    }
    
    return 'blue';
  }
  
  private static mapGoogleStatusToStatus(category?: string): 'visited' | 'want_to_visit' | 'planning' {
    if (!category) return 'planning';
    
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('visited')) return 'visited';
    if (lowerCategory.includes('want to go')) return 'want_to_visit';
    
    return 'planning';
  }
  
  private static detectCategory(name?: string, description?: string): PointCategory {
    const text = `${name} ${description}`.toLowerCase();
    
    // Проверяем ключевые слова
    if (/гора|mountain|peak|вершина/i.test(text)) return 'mountain';
    if (/замок|castle|fortress|крепость/i.test(text)) return 'castle';
    if (/музей|museum|gallery|галерея/i.test(text)) return 'museum';
    if (/ресторан|restaurant|кафе|cafe/i.test(text)) return 'restaurant';
    if (/озеро|lake|море|sea|beach|пляж/i.test(text)) return 'lake';
    if (/церковь|church|храм|собор|cathedral/i.test(text)) return 'church';
    if (/парк|park|сад|garden/i.test(text)) return 'park';
    
    return 'other';
  }
}
```

### 5.2 OSM Parser

```typescript
// src/api/parsers/osmParser.ts
import type { ImportedPoint, PointCategory } from '@/types/userPoints';

export class OSMParser {
  /**
   * Парсит данные из OpenStreetMap
   * Поддерживает форматы: GPX, GeoJSON
   */
  static async parse(file: File): Promise<ImportedPoint[]> {
    const text = await file.text();
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'geojson' || extension === 'json') {
      return this.parseGeoJSON(text);
    } else if (extension === 'gpx') {
      return this.parseGPX(text);
    }
    
    throw new Error('Неподдерживаемый формат файла');
  }
  
  private static parseGeoJSON(text: string): ImportedPoint[] {
    const data = JSON.parse(text);
    const points: ImportedPoint[] = [];
    
    const features = data.features || [];
    
    for (const feature of features) {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      
      if (!coords || coords.length < 2) continue;
      
      const point: ImportedPoint = {
        id: crypto.randomUUID(),
        name: props.name || 'Без названия',
        description: props.description,
        latitude: coords[1],
        longitude: coords[0],
        color: 'blue',
        category: this.detectCategoryFromTags(props),
        status: 'planning',
        source: 'osm',
        importedAt: new Date().toISOString(),
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static parseGPX(text: string): ImportedPoint[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const waypoints = doc.getElementsByTagName('wpt');
    const points: ImportedPoint[] = [];
    
    for (let i = 0; i < waypoints.length; i++) {
      const wpt = waypoints[i];
      const lat = parseFloat(wpt.getAttribute('lat') || '0');
      const lon = parseFloat(wpt.getAttribute('lon') || '0');
      const name = wpt.getElementsByTagName('name')[0]?.textContent || 'Без названия';
      const desc = wpt.getElementsByTagName('desc')[0]?.textContent;
      
      const point: ImportedPoint = {
        id: crypto.randomUUID(),
        name,
        description: desc || undefined,
        latitude: lat,
        longitude: lon,
        color: 'blue',
        category: 'other',
        status: 'planning',
        source: 'osm',
        importedAt: new Date().toISOString(),
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static detectCategoryFromTags(props: any): PointCategory {
    const amenity = props.amenity;
    const tourism = props.tourism;
    const natural = props.natural;
    
    if (tourism === 'museum') return 'museum';
    if (tourism === 'castle') return 'castle';
    if (amenity === 'restaurant') return 'restaurant';
    if (amenity === 'cafe') return 'cafe';
    if (natural === 'peak') return 'mountain';
    if (natural === 'beach') return 'beach';
    
    return 'other';
  }
}
```

---

## 6. UI/UX требования

### 6.1 Дизайн системы

#### 6.1.1 Цветовая схема маркеров
```typescript
const MARKER_COLORS = {
  green: '#4CAF50',    // Material Green 500
  purple: '#9C27B0',   // Material Purple 500
  brown: '#795548',    // Material Brown 500
  blue: '#2196F3',     // Material Blue 500
  red: '#F44336',      // Material Red 500
  yellow: '#FFC107',   // Material Amber 500
  gray: '#9E9E9E'      // Material Grey 500
};
```

#### 6.1.2 Иконки маркеров
- Использовать библиотеку `lucide-react-native`
- Размер маркера: 32x32 dp
- Тень для выделения на карте
- Анимация при клике

#### 6.1.3 Адаптивность
- **Mobile**: Bottom sheet для списка точек
- **Tablet**: Split view (карта + список)
- **Web**: Sidebar с фильтрами

### 6.2 Пользовательские сценарии

#### 6.2.1 Импорт точек
1. Пользователь нажимает "Импортировать точки"
2. Выбирает источник (Google Maps / OSM)
3. Загружает файл
4. Видит предпросмотр данных
5. Настраивает категории (опционально)
6. Подтверждает импорт
7. Видит импортированные точки на карте

#### 6.2.2 Фильтрация точек
1. Пользователь открывает панель фильтров
2. Выбирает цветовые категории (чипсы)
3. Выбирает типы мест (dropdown)
4. Устанавливает радиус поиска (slider)
5. Карта обновляется в реальном времени

#### 6.2.3 Построение маршрута
1. Пользователь выбирает "Построить маршрут"
2. Выбирает точки на карте или из списка (до 10)
3. Выбирает транспорт (авто/велосипед/пешком)
4. Нажимает "Рассчитать"
5. Видит маршрут на карте с деталями
6. Может сохранить маршрут

#### 6.2.4 Рекомендации
1. Пользователь нажимает "Куда поехать сегодня?"
2. Указывает количество рекомендаций (по умолчанию 4)
3. Настраивает фильтры (опционально)
4. Видит карточки с рекомендациями
5. Может построить маршрут до выбранной точки

### 6.3 Производительность

#### 6.3.1 Оптимизация карты
- Кластеризация маркеров при zoom < 12
- Lazy loading точек при прокрутке списка
- Debounce для фильтров (300ms)
- Виртуализация списка (react-native-virtualized-view)

#### 6.3.2 Кэширование
- Кэш импортированных точек (React Query, 10 минут)
- Кэш маршрутов (5 минут)
- Offline support для просмотра точек

---

## 7. Тестирование

### 7.1 Unit тесты

```typescript
// __tests__/parsers/googleMapsParser.test.ts
describe('GoogleMapsParser', () => {
  it('should parse JSON format', async () => {
    const file = new File([mockGoogleJSON], 'places.json');
    const points = await GoogleMapsParser.parse(file);
    
    expect(points).toHaveLength(5);
    expect(points[0].source).toBe('google_maps');
  });
  
  it('should detect categories correctly', () => {
    const category = GoogleMapsParser.detectCategory('Mountain Peak', '');
    expect(category).toBe('mountain');
  });
});

// __tests__/hooks/useUserPoints.test.ts
describe('useUserPoints', () => {
  it('should fetch points with filters', async () => {
    const { result } = renderHook(() => useUserPoints({ colors: ['green'] }));
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

### 7.2 Integration тесты

```typescript
// __tests__/integration/pointImport.test.tsx
describe('Point Import Flow', () => {
  it('should complete full import workflow', async () => {
    const { getByText, getByTestId } = render(<ImportWizard />);
    
    // Выбор источника
    fireEvent.press(getByText('Google Maps'));
    
    // Загрузка файла
    const fileInput = getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Подтверждение
    await waitFor(() => {
      expect(getByText('Импортировать')).toBeEnabled();
    });
    
    fireEvent.press(getByText('Импортировать'));
    
    // Проверка результата
    await waitFor(() => {
      expect(getByText('Импорт завершен')).toBeVisible();
    });
  });
});
```

### 7.3 E2E тесты (Playwright)

```typescript
// e2e/userPoints.spec.ts
test('should import and filter user points', async ({ page }) => {
  await page.goto('/map');
  
  // Импорт
  await page.click('text=Импортировать точки');
  await page.click('text=Google Maps');
  await page.setInputFiles('input[type="file"]', 'fixtures/google-places.json');
  await page.click('text=Импортировать');
  
  await expect(page.locator('text=Импорт завершен')).toBeVisible();
  
  // Фильтрация
  await page.click('text=Фильтры');
  await page.click('[data-color="green"]');
  
  // Проверка результата
  const markers = page.locator('[data-testid="point-marker"]');
  await expect(markers).toHaveCount(3);
});
```

---

## 8. Безопасность

### 8.1 Валидация данных

```typescript
// utils/validation.ts
import { z } from 'zod';

export const ImportedPointSchema = z.object({
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  color: z.enum(['green', 'purple', 'brown', 'blue', 'red', 'yellow', 'gray']),
  category: z.enum([
    'mountain', 'lake', 'forest', 'beach', 'park',
    'castle', 'church', 'monument', 'museum',
    'restaurant', 'cafe', 'hotel', 'shop',
    'theater', 'cinema', 'attraction', 'other'
  ]),
  status: z.enum(['visited', 'want_to_visit', 'planning', 'archived']),
  description: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

export const validateImportedPoint = (data: unknown) => {
  return ImportedPointSchema.safeParse(data);
};
```

### 8.2 Ограничения

```typescript
const IMPORT_LIMITS = {
  maxFileSize: 10 * 1024 * 1024,      // 10 MB
  maxPointsPerImport: 1000,            // Максимум 1000 точек за раз
  maxPointsPerUser: 10000,             // Максимум 10000 точек на пользователя
  maxRouteWaypoints: 10,               // Максимум 10 точек в маршруте
  maxPhotosPerPoint: 20,               // Максимум 20 фото на точку
  maxPhotoSize: 5 * 1024 * 1024,      // 5 MB на фото
};
```

### 8.3 Санитизация

```typescript
// utils/sanitization.ts
import DOMPurify from 'dompurify';

export const sanitizePointData = (point: any): ImportedPoint => {
  return {
    ...point,
    name: DOMPurify.sanitize(point.name),
    description: point.description ? DOMPurify.sanitize(point.description) : undefined,
    notes: point.notes ? DOMPurify.sanitize(point.notes) : undefined,
  };
};
```

---

## 9. Метрики и аналитика

### 9.1 Отслеживаемые события

```typescript
// Analytics events
const ANALYTICS_EVENTS = {
  // Импорт
  IMPORT_STARTED: 'user_points_import_started',
  IMPORT_COMPLETED: 'user_points_import_completed',
  IMPORT_FAILED: 'user_points_import_failed',
  
  // CRUD
  POINT_CREATED: 'user_point_created',
  POINT_UPDATED: 'user_point_updated',
  POINT_DELETED: 'user_point_deleted',
  
  // Фильтрация
  FILTERS_APPLIED: 'user_points_filters_applied',
  SEARCH_PERFORMED: 'user_points_search_performed',
  
  // Маршруты
  ROUTE_CALCULATED: 'route_calculated',
  ROUTE_SAVED: 'route_saved',
  
  // Рекомендации
  RECOMMENDATIONS_REQUESTED: 'recommendations_requested',
  RECOMMENDATION_CLICKED: 'recommendation_clicked',
};
```

### 9.2 Метрики производительности

```typescript
// Performance metrics
const PERFORMANCE_METRICS = {
  importDuration: 'Время импорта точек',
  routeCalculationTime: 'Время расчета маршрута',
  mapRenderTime: 'Время рендера карты',
  filterResponseTime: 'Время отклика фильтров',
};
```

---

## 10. Roadmap

### 10.1 MVP (Phase 1) - 4 недели

**Неделя 1-2: Импорт и базовый функционал**
- [ ] Парсеры Google Maps (JSON, KML)
- [ ] Парсер OSM (GeoJSON, GPX)
- [ ] API endpoints для CRUD операций
- [ ] Базовый UI импорта
- [ ] Отображение точек на карте

**Неделя 3: Фильтрация и категоризация**
- [ ] Цветовые категории
- [ ] Автоопределение типов мест
- [ ] Панель фильтров
- [ ] Поиск по точкам

**Неделя 4: Маршруты**
- [ ] Построение простого маршрута (A → B)
- [ ] Выбор транспорта
- [ ] Отображение маршрута на карте
- [ ] Статистика маршрута

### 10.2 Phase 2 - 3 недели

**Неделя 5: Продвинутые маршруты**
- [ ] Маршрут через несколько точек
- [ ] Оптимизация порядка точек
- [ ] Сохранение маршрутов
- [ ] История маршрутов

**Неделя 6: Рекомендации**
- [ ] Алгоритм рекомендаций
- [ ] UI рекомендаций
- [ ] Фильтры рекомендаций
- [ ] "Куда поехать сегодня"

**Неделя 7: Полировка**
- [ ] Оптимизация производительности
- [ ] Кластеризация маркеров
- [ ] Offline support
- [ ] Тестирование

### 10.3 Future Features (Phase 3+)

- [ ] Экспорт точек в различные форматы
- [ ] Шаринг точек с другими пользователями
- [ ] Коллаборативные маршруты
- [ ] Интеграция с календарем
- [ ] Push-уведомления о рекомендациях
- [ ] AR навигация
- [ ] Голосовые заметки к точкам
- [ ] Автоматическое определение посещенных мест (геотрекинг)

---

## 11. Зависимости

### 11.1 Frontend

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "zod": "^3.22.0",
    "dompurify": "^3.0.0",
    "lucide-react-native": "^0.300.0",
    "react-native-maps": "^1.10.0",
    "react-native-gesture-handler": "^2.14.0",
    "@gorhom/bottom-sheet": "^4.5.0",
    "react-native-reanimated": "^3.6.0"
  }
}
```

### 11.2 Backend (Python)

```python
# requirements.txt
django>=4.2.0
djangorestframework>=3.14.0
django-cors-headers>=4.3.0
geopy>=2.4.0
shapely>=2.0.0
fastkml>=1.0.0  # для парсинга KML
gpxpy>=1.6.0    # для парсинга GPX
```

---

## 12. Критерии приемки

### 12.1 Функциональные

- [ ] Пользователь может импортировать точки из Google Maps (JSON, KML)
- [ ] Пользователь может импортировать точки из OSM (GeoJSON, GPX)
- [ ] Точки отображаются на карте с правильными цветами
- [ ] Работает фильтрация по цветам, категориям, статусам
- [ ] Работает текстовый поиск по точкам
- [ ] Можно построить маршрут от текущего местоположения до точки
- [ ] Можно построить маршрут через несколько точек (до 10)
- [ ] Работают рекомендации "Куда поехать сегодня"
- [ ] Можно редактировать и удалять точки
- [ ] Статистика отображается корректно

### 12.2 Нефункциональные

- [ ] Импорт 100 точек занимает < 5 секунд
- [ ] Расчет маршрута занимает < 3 секунд
- [ ] Карта рендерится плавно (60 FPS) с 1000+ точками
- [ ] Фильтры отрабатывают мгновенно (< 300ms)
- [ ] Приложение работает offline (просмотр точек)
- [ ] Покрытие тестами > 80%
- [ ] Нет критических уязвимостей безопасности

### 12.3 UX

- [ ] Интуитивный процесс импорта (< 5 шагов)
- [ ] Понятные иконки и цвета категорий
- [ ] Адаптивный дизайн (mobile/tablet/web)
- [ ] Информативные сообщения об ошибках
- [ ] Плавные анимации и переходы

---

## 13. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Несовместимость форматов Google Maps | Средняя | Высокое | Поддержка нескольких форматов, подробная документация |
| Проблемы с производительностью при большом количестве точек | Высокая | Среднее | Кластеризация, виртуализация, пагинация |
| Сложность алгоритма оптимизации маршрутов | Средняя | Среднее | Использование готовых библиотек (OpenRouteService) |
| Ограничения API маршрутизации | Низкая | Высокое | Fallback на альтернативные сервисы |
| Проблемы с геолокацией на iOS/Android | Низкая | Среднее | Запрос разрешений, fallback на ручной ввод |

---

## 14. Контакты и ресурсы

### 14.1 Документация API

- Google Takeout: https://takeout.google.com/
- OpenStreetMap API: https://wiki.openstreetmap.org/wiki/API
- OpenRouteService: https://openrouteservice.org/dev/#/api-docs

### 14.2 Дизайн

- Figma: [ссылка на макеты]
- Design System: `@/constants/designSystem.ts`

### 14.3 Команда

- **Frontend Lead**: [имя]
- **Backend Lead**: [имя]
- **QA**: [имя]
- **Product Owner**: [имя]

---

## Приложения

### A. Примеры форматов данных

#### A.1 Google Maps JSON (Takeout)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [27.5615, 53.9045]
      },
      "properties": {
        "Title": "Минск",
        "Category": "Want to go",
        "Google Maps URL": "https://maps.google.com/?cid=123",
        "description": "Столица Беларуси"
      }
    }
  ]
}
```

#### A.2 OSM GeoJSON
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [27.5615, 53.9045]
      },
      "properties": {
        "name": "Минск",
        "amenity": "city",
        "tourism": "attraction"
      }
    }
  ]
}
```

#### A.3 GPX
```xml
<?xml version="1.0"?>
<gpx version="1.1">
  <wpt lat="53.9045" lon="27.5615">
    <name>Минск</name>
    <desc>Столица Беларуси</desc>
  </wpt>
</gpx>
```

---

**Версия документа**: 1.0  
**Дата создания**: 18 января 2026  
**Автор**: AI System Architect  
**Статус**: Draft → Review → Approved
