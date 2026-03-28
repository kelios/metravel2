# Architecture Overview — MeTravel

## Точки входа

| Платформа | Точка входа |
|-----------|------------|
| Все платформы | `entry.js` → `app/_layout.tsx` |
| Web (статика) | `dist/prod/index.html` (после `npm run build:web`) |
| iOS / Android | EAS-билд → нативная обёртка вокруг Expo |

Expo Router использует файловую систему как маршруты: каждый файл в `app/` становится экраном.

---

## Модули и их назначение

### `app/` — Экраны (Routing Layer)
- Файловый роутинг (как Next.js pages/)
- `_layout.tsx` — корневой лейаут, оборачивает приложение в провайдеры
- `(tabs)/` — таб-навигация (основные разделы)
- Отдельные экраны: детали путешествий, статьи, профиль, карта

### `components/` — UI Layer
- `ui/` — атомарные переиспользуемые компоненты: `ImageCardMedia`, `UnifiedTravelCard`, кнопки, инпуты
- `common/` — составные переиспользуемые блоки
- `layout/` — лейаутные обёртки (хедер, скроллы, контейнеры)
- Фичевые директории (`travel/`, `article/`, `map/`, `quest/` и др.) — компоненты для конкретных доменов

### `api/` — Data Fetching Layer
- Обёртки над `fetch` с авторизационными хедерами
- TanStack Query hooks (`*Queries.ts`) — кэширование, рефетч, мутации
- Организованы по доменам: `api/travels/`, `api/articles/`, `api/auth/`, `api/map/` и др.
- Базовый URL из `EXPO_PUBLIC_API_URL`

### `stores/` — Client State Layer
- 8 Zustand-сторов для UI-состояния
- Примеры: фильтры поиска, состояние карты, UI-настройки
- Не дублирует серверный стейт (это зона React Query)

### `context/` — Shared Context
- `AuthContext` — текущий пользователь, токен, логин/логаут
- `FavoritesContext` — избранные объекты
- Используется через `useContext` или кастомные хуки

### `hooks/` — Custom Hooks (84 файла)
- Инкапсулируют логику взаимодействия с API, сторами, платформой
- Соглашение: `use<Feature><Action>` (напр. `useTravelDetails`, `useMapLocation`)

### `utils/` — Utilities (101 файл)
- Хелперы без React-зависимости
- `externalLinks.ts` — единственная точка открытия внешних URL
- Форматирование дат, строк, координат, PDF, ZIP и др.

### `types/` — TypeScript Types
- Глобальные типы и интерфейсы, используемые в нескольких модулях
- Доменные типы (`Travel`, `Article`, `User`, `MapPoint` и др.)

---

## Потоки данных

### Серверные данные (Server State)
```
Компонент
  → useQuery/useMutation (из api/*Queries.ts)
  → fetch + Authorization header
  → Backend API (EXPO_PUBLIC_API_URL)
  ← React Query cache (автоматическое кэширование и инвалидация)
```

### Клиентский стейт (UI State)
```
Компонент
  → useStore (Zustand)
  → store action
  ← реактивное обновление всех подписчиков
```

### Аутентификация
```
app/_layout.tsx
  → AuthContext.Provider
  → useAuthContext() в любом компоненте
  → токен хранится в expo-secure-store
  → добавляется в каждый API-запрос
```

### Навигация
```
Expo Router (file-based)
  → app/(tabs)/ — таб-навигация
  → app/travel/[id].tsx — динамические маршруты
  → expo-linking — deep links и universal links
```

### Карты
```
Web:    Leaflet + React Leaflet → OpenStreetMap tiles
iOS:    Apple Maps (expo-location + react-native-maps)
Android: Google Maps (react-native-maps)
Routing: OpenRouteService API (EXPO_PUBLIC_ORS_API_KEY)
```

---

## Зависимости между слоями

```
app/ (экраны)
  ├── компоненты из components/
  │     └── атомарные из components/ui/
  ├── данные через hooks/
  │     ├── серверный стейт: api/*Queries.ts → Backend
  │     └── клиентский стейт: stores/*
  ├── контекст из context/ (Auth, Favorites)
  └── утилиты из utils/
```

**Правило направления зависимостей:**
- `app/` → `components/` → `hooks/` → `api/` + `stores/`
- Обратные зависимости запрещены (компонент не импортирует экран)
- `utils/` и `types/` — листовые узлы (ни от чего не зависят)

---

## Платформенные различия

| Возможность | Web | iOS | Android |
|-------------|-----|-----|---------|
| Карты | Leaflet (OpenStreetMap) | Apple Maps | Google Maps |
| Уведомления | Web Push | APNs | FCM |
| Хранилище | localStorage/IndexedDB | expo-secure-store | expo-secure-store |
| Изображения | react-dropzone | expo-image-picker | expo-image-picker |
| Аутентификация | Cookie/Token | expo-auth-session | expo-auth-session |
| Биометрия | — | expo-local-authentication | expo-local-authentication |

Платформенные ветки обрабатываются через `Platform.OS` и платформенные расширения файлов (`.web.tsx`, `.native.tsx`).

---

## Build Output

```
dist/prod/        # Web статика (после npm run build:web)
  index.html      # SPA точка входа
  _expo/          # Бандлы (JS, CSS, assets)
  <route>.html    # Pre-rendered страницы (SEO)

test-results/     # Jest + Playwright отчёты
lighthouse-reports/ # Аудиты производительности
```

---

## Внешние сервисы

| Сервис | Назначение | Конфигурация |
|--------|-----------|--------------|
| metravel.by API | Основной бэкенд | `EXPO_PUBLIC_API_URL` |
| OpenStreetMap | Тайлы карт (web) | без ключа |
| OpenRouteService | Маршруты/расстояния | `EXPO_PUBLIC_ORS_API_KEY` |
| EAS Build | Облачная сборка iOS/Android | `eas.json` |
| App Store / Google Play | Дистрибуция | `eas.json` submit |
