# 🚀 Performance Improvement Plan — Metravel

> **Дата:** Март 2026  
> **Автор:** Performance Engineering  
> **Статус:** Утверждён  
> **Целевые метрики:** Desktop ≥ 90, Mobile ≥ 75  
> **Текущие метрики:** Desktop 89–92, Mobile 62–68  
> **Главное узкое место:** Entry bundle ~4.7 MB, LCP ~9.7 с (mobile, travel detail)

---

## 0. Executive Summary

Приложение Metravel (React Native Web + Expo Router) демонстрирует хорошие desktop-показатели (89–92), но на mobile (с 4× CPU throttling Lighthouse) показывает 62–68 баллов. Основные проблемы: огромный entry bundle (4.7 MB), высокий LCP на страницах маршрутов (до 9.7 с mobile), значительный объём unused JS (~150–200 KB из RNW), и тяжёлые зависимости (react-leaflet, PDF, quill, reanimated — суммарно ~1.5 MB).

**Этот план содержит 6 фаз (P1–P6) с конкретными задачами, ожидаемым эффектом и способами валидации.**

---

## 1. Текущее состояние — Baseline

### 1.1 Lighthouse метрики (production, mobile, travel detail page)

| Метрика | Текущее значение | Цель |
|---------|-----------------|------|
| **Performance Score** | 62–68 (mobile) / 89–92 (desktop) | ≥ 75 (mobile) / ≥ 90 (desktop) |
| **FCP** | ~1.7 с | ≤ 1.5 с |
| **LCP** | ~9.7 с (mobile travel detail) | ≤ 4.0 с |
| **Speed Index** | ~7.3 с | ≤ 4.0 с |
| **TBT** | — | ≤ 200 мс |
| **CLS** | — | ≤ 0.1 |

### 1.2 Bundle

| Параметр | Текущее значение | Цель |
|----------|-----------------|------|
| Entry bundle (web) | ~4.7 MB | ≤ 2.5 MB |
| Heavy deps total | ~1.5 MB (BASELINE_METRICS) | ≤ 800 KB |
| Unused JS (RNW) | ~150–200 KB | ≤ 50 KB |
| Estimated gzipped | ~250–350 KB | ≤ 200 KB |

### 1.3 Тяжёлые зависимости (из BASELINE_METRICS.json)

| Зависимость | Вес | Категория | Используется на всех страницах? |
|-------------|-----|-----------|-------------------------------|
| `react-leaflet` | ~200 KB | Mapping | Нет (только /map, travel detail) |
| `react-native-reanimated` | ~200 KB | Animation | Частично |
| `react-native-paper` | ~200 KB | UI Library | Частично |
| `@react-pdf/renderer` | ~200 KB | PDF | Нет (только export) |
| `pdf-lib` | ~200 KB | PDF | Нет (только export) |
| `@react-navigation/native` | ~150 KB | Navigation | Да |
| `react-native-gesture-handler` | ~150 KB | Gestures | Да |
| `lucide-react-native` | ~60 KB | Icons | Частично |
| `lucide-react` | ~60 KB | Icons | Частично |
| `html2canvas` | — | Screenshot | Нет (только export) |
| `quill` | — | Rich text | Нет (только редактор) |
| `jszip` | — | ZIP | Нет (только export) |

---

## 2. Фаза P1 — Bundle Splitting & Lazy Loading (Критическая)

> **Ожидаемый эффект:** Entry bundle −40–50%, LCP −2–3 с, Mobile score +8–12

### P1.1 Route-level code splitting

**Проблема:** Все страницы загружаются в одном bundle, включая тяжёлые маршруты (/map, travel detail, export).

**Решение:**
```tsx
// app/(tabs)/map.tsx
import { lazy, Suspense } from 'react';
const MapScreen = lazy(() => import('@/screens/MapScreen'));

export default function MapRoute() {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <MapScreen />
    </Suspense>
  );
}
```

**Целевые маршруты для ленивой загрузки:**

| Маршрут | Тяжёлые зависимости | Экономия |
|---------|---------------------|----------|
| `/map` | react-leaflet, leaflet, clustering | ~400 KB |
| `/travels/[slug]` (map-часть) | react-leaflet, leaflet | ~300 KB |
| `/export` | @react-pdf/renderer, pdf-lib, html2canvas, jszip | ~600 KB |
| `/quests` (редактор) | quill | ~200 KB |
| `/userpoints` | leaflet (если используется) | ~200 KB |

**Файлы для изменения:**
- `app/(tabs)/map.tsx` — lazy import
- `app/travels/[slug].tsx` — lazy import карты внутри страницы
- `app/(tabs)/export.tsx` — lazy import
- Компоненты с `quill` — lazy import

**Валидация:**
```bash
npm run build:web:prod
npm run analyze:bundle
# Проверить наличие chunk-файлов в dist/prod/_expo/static/
```

### P1.2 Динамический import для Leaflet

**Проблема:** `react-leaflet` + `leaflet` загружаются синхронно через `useLeafletLoader`, но сами библиотеки тяжёлые.

**Решение:** Убедиться, что `useLeafletLoader` использует `dynamic import()` и не блокирует main thread:

```typescript
// hooks/useLeafletLoader.ts
export function useLeafletLoader() {
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    // Загрузка только когда карта видима
    const loadLeaflet = async () => {
      await import('leaflet');
      await import('react-leaflet');
      setLoaded(true);
    };
    
    // Используем IntersectionObserver для загрузки при видимости
    requestIdleCallback(() => loadLeaflet(), { timeout: 3000 });
  }, []);
  
  return loaded;
}
```

### P1.3 Lazy import PDF/export модулей

**Проблема:** `@react-pdf/renderer`, `pdf-lib`, `html2canvas`, `jszip` загружаются при старте, хотя нужны только на странице экспорта.

**Решение:** Все PDF/ZIP импорты → `dynamic import()` внутри функций генерации:

```typescript
// utils/pdfGenerator.ts
export async function generatePDF(data: TravelData) {
  const { Document, Page, Text, pdf } = await import('@react-pdf/renderer');
  const { PDFDocument } = await import('pdf-lib');
  // ... генерация
}
```

### P1.4 Icon tree-shaking

**Проблема:** Два пакета иконок (`lucide-react` + `lucide-react-native`, суммарно ~120 KB) подключены полностью.

**Решение:**
- Перейти на именованные импорты: `import { MapPin } from 'lucide-react'` вместо barrel
- Или заменить на `@expo/vector-icons/Feather` (рекомендован в RULES.md)
- Убрать `lucide-react-native` на web (он stubbed в metro-stubs)

**Файлы для анализа:**
```bash
grep -r "from 'lucide-react" --include="*.tsx" --include="*.ts" -l
```

---

## 3. Фаза P2 — RNW Tree-Shaking (Реализовано, требуется production-включение)

> **Ожидаемый эффект:** Unused JS −150–200 KB, TBT −50–100 мс

### P2.1 Включить RNW slim barrel в production

**Статус:** ADR принят, `metro-stubs/react-native-web-slim.js` создан, aliasing opt-in.

**Действие:** Включить `EXPO_PUBLIC_RNW_SLIM=1` в production build (уже включён в `build:web:prod` скрипте).

**Валидация:**
```bash
EXPO_PUBLIC_RNW_SLIM=1 npx expo export --platform web
# Сравнить Lighthouse unused JS с BASELINE_METRICS.json
# Запустить E2E smoke: home, search, map, travel detail
```

### P2.2 Аудит slim barrel completeness

Проверить, что все модули из `docs/RNW_USAGE_AUDIT.md` включены в slim barrel:
- High-frequency: `View`, `Text`, `StyleSheet`, `Platform`, `Pressable`
- Medium: `ScrollView`, `ActivityIndicator`, `Image`, `Animated`, `TouchableOpacity`, `useWindowDimensions`
- Low: `Modal`, `SafeAreaView`, `RefreshControl`, `Dimensions`, `TextInput`, etc.

---

## 4. Фаза P3 — LCP Optimization (Главная + Travel Detail)

> **Ожидаемый эффект:** LCP −3–5 с на mobile

### P3.1 Preload hero image

**Проблема:** LCP элемент (hero image на travel detail) начинает загружаться только после JS bundle parse.

**Решение:** Добавить `<link rel="preload">` для hero image в SSG/SSR или в `<head>`:

```tsx
// components/seo/LazyInstantSEO.tsx (или +html.tsx)
{heroImageUrl && (
  <link
    rel="preload"
    as="image"
    href={heroImageUrl}
    fetchPriority="high"
  />
)}
```

**Для страниц маршрутов** (генерируемых через `scripts/generate-seo-pages.js`):
- Вставить `<link rel="preload" as="image" href="{thumb_url}">` в HTML-шаблон

### P3.2 Критический CSS inline

**Проблема:** CSS загружается после JS, что задерживает FCP.

**Решение:**
- Инлайнить критический CSS в `<head>` через `+html.tsx`
- Leaflet CSS подключать только на страницах с картой (сейчас подключается глобально)

### P3.3 Font loading strategy

**Решение:** Добавить `font-display: swap` для всех кастомных шрифтов + preload:

```html
<link rel="preload" as="font" type="font/ttf" href="/assets/fonts/Feather.ttf" crossorigin>
```

### P3.4 Image optimization

**Текущее:** Используется `expo-image` с blurhash placeholders (✅ PERF-02 реализован).

**Дополнительные улучшения:**
- Добавить `priority` / `fetchPriority="high"` для above-the-fold изображений
- Использовать `loading="lazy"` для below-the-fold изображений
- Проверить, что thumbnail URLs (`travel_image_thumb_url`) используются вместо full-size
- Рассмотреть WebP/AVIF форматы на стороне сервера

### P3.5 Server-side prerendering (SSG) для ключевых страниц

**Проблема:** Все страницы рендерятся на клиенте — JS должен загрузиться и выполниться перед первым paint.

**Решение:** Использовать `scripts/generate-seo-pages.js` для создания HTML-shell:
- Главная (`/`) — prerender hero + skeleton
- Поиск (`/search`) — prerender header + skeleton карточек
- Страницы маршрутов (`/travels/[slug]`) — уже генерируются, добавить inline critical CSS + hero preload

---

## 5. Фаза P4 — Runtime Performance

> **Ожидаемый эффект:** TBT −100–200 мс, INP ≤ 200 мс

### P4.1 Inline requires (✅ уже включено)

`metro.config.js` уже имеет `inlineRequires: true`. Это откладывает выполнение тяжёлых модулей до первого использования.

### P4.2 Оптимизация re-renders

**Проблема:** Некоторые контексты (AuthContext, MapFiltersContext) вызывают каскадные re-renders.

**Решение по ADR_STATE_MANAGEMENT:**
1. Zustand stores с selectors — предотвращают лишние re-renders:
   ```typescript
   // Плохо: подписка на весь store
   const store = useFavoritesStore();
   
   // Хорошо: подписка на конкретное поле
   const count = useFavoritesStore((s) => s.favorites.length);
   ```

2. `React.memo()` для тяжёлых компонентов (карточки, списки)
3. `useCallback`/`useMemo` для обработчиков в списках

**Файлы для аудита:**
```bash
grep -rn "useFavoritesStore()" --include="*.tsx" -l
grep -rn "useAuth()" --include="*.tsx" -l
```

### P4.3 Виртуализация списков

**Текущее:** Используется `@shopify/flash-list` (✅).

**Проверить:**
- `estimatedItemSize` задан правильно
- `keyExtractor` стабилен (не создаёт новые ключи)
- Нет тяжёлых вычислений в `renderItem`
- `getItemType` используется для гетерогенных списков

### P4.4 Debounce для search/filters

**Текущее:** `useDebounce` и `useDebouncedValue` существуют.

**Проверить:** Все API вызовы из поисковых полей и фильтров используют debounce ≥ 300 мс.

### P4.5 Web Worker для тяжёлых вычислений

Рассмотреть Web Worker для:
- Парсинг GPX/KML файлов (`api/parsers/`)
- Elevation вычисления (`map-core/useElevation.ts`)
- PDF генерация

---

## 6. Фаза P5 — Network & Caching

> **Ожидаемый эффект:** Повторные загрузки −60–80%, TTFB −200–500 мс

### P5.1 React Query оптимизации (✅ частично)

**Текущее:** `reactQueryConfig.ts` настроен с staleTime 5 мин, gcTime 10 мин.

**Дополнительно:**
- Prefetch данных следующей страницы при hover на карточке:
  ```typescript
  const queryClient = useQueryClient();
  const handleHover = (slug: string) => {
    queryClient.prefetchQuery({
      queryKey: ['travel', slug],
      queryFn: () => fetchTravelBySlug(slug),
      staleTime: 5 * 60 * 1000,
    });
  };
  ```
- Использовать `queryConfigs.static` для фильтров и стран (редко меняются):
  ```typescript
  useQuery({
    queryKey: ['filters'],
    queryFn: fetchFilters,
    ...queryConfigs.static, // staleTime: 30 мин
  });
  ```

### P5.2 HTTP caching headers (Nginx)

**По правилам RULES.md:** Не использовать `Cache-Control: immutable` для JS bundles. Держать revalidation.

**Рекомендации для статических ресурсов:**
```nginx
# Изображения (thumb) — агрессивный кэш
location ~* \.(jpg|jpeg|png|webp|avif)$ {
    expires 7d;
    add_header Cache-Control "public, max-age=604800";
}

# JS/CSS bundles — revalidation (per RULES.md)
location /_expo/static/ {
    add_header Cache-Control "max-age=0, must-revalidate";
    etag on;
}

# Fonts — долгий кэш (содержимое не меняется)
location ~* \.(woff2?|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
}
```

### P5.3 API response compression

**Проверить:** Nginx сжимает API responses (JSON) gzip/brotli.

```nginx
gzip on;
gzip_types application/json text/css application/javascript;
gzip_min_length 256;

# Brotli (если модуль установлен)
brotli on;
brotli_types application/json text/css application/javascript;
```

### P5.4 Image CDN / responsive images

- Запросить у бэкенда генерацию thumb разных размеров (320w, 640w, 1024w)
- Использовать `srcSet` на web для responsive images
- Рассмотреть CDN (Cloudflare, imgproxy) для on-the-fly resize

---

## 7. Фаза P6 — Build & Deploy Optimization

> **Ожидаемый эффект:** Build size −15–25%, deploy speed +30%

### P6.1 Production-only dependencies

**Проверить:** Эти пакеты не попадают в web bundle:
- `react-native-maps` — stubbed для web ✅
- `react-native-image-picker` — native only
- `expo-location` — проверить lazy load
- `react-native-document-picker` — native only

### P6.2 Console removal (✅ уже настроено)

`babel.config.js` уже имеет `transform-remove-console` в production (кроме error, warn, info).

### P6.3 Source maps

`build:web:prod` скрипт уже отключает source maps: `EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false`.

### P6.4 Minification

`build:web:prod` уже включает `EXPO_WEB_BUILD_MINIFY=true`.

### P6.5 Удаление дублирующихся зависимостей

```bash
npx yarn-deduplicate
yarn install
```

Проверить дубли React, React DOM, @babel/runtime в bundle.

---

## 8. Матрица приоритетов

| Фаза | Задача | Усилия | Влияние | Приоритет |
|------|--------|--------|---------|-----------|
| P1.1 | Route-level code splitting | Среднее | 🔴 Высокое | **P0** |
| P1.2 | Lazy Leaflet import | Низкое | 🔴 Высокое | **P0** |
| P1.3 | Lazy PDF/export | Низкое | 🟠 Высокое | **P0** |
| P1.4 | Icon tree-shaking | Низкое | 🟡 Среднее | P1 |
| P2.1 | RNW slim в production | Низкое | 🟡 Среднее | P1 |
| P3.1 | Preload hero image | Низкое | 🔴 Высокое | **P0** |
| P3.2 | Critical CSS inline | Среднее | 🟡 Среднее | P1 |
| P3.3 | Font preload + swap | Низкое | 🟡 Среднее | P1 |
| P3.4 | Image optimization | Среднее | 🔴 Высокое | **P0** |
| P3.5 | SSG для ключевых страниц | Высокое | 🔴 Высокое | P1 |
| P4.2 | Re-render оптимизация | Среднее | 🟡 Среднее | P2 |
| P4.3 | Проверка Flash List config | Низкое | 🟡 Среднее | P2 |
| P4.5 | Web Workers | Высокое | 🟡 Среднее | P3 |
| P5.1 | React Query prefetch | Низкое | 🟡 Среднее | P2 |
| P5.2 | HTTP cache headers | Низкое | 🟠 Высокое | P1 |
| P5.3 | API compression | Низкое | 🟡 Среднее | P1 |
| P5.4 | Image CDN | Высокое | 🔴 Высокое | P2 |
| P6.5 | Deduplicate deps | Низкое | 🟡 Среднее | P2 |

---

## 9. Рекомендуемый порядок спринтов

### 🔥 Спринт 1 (1 неделя) — Quick wins: bundle & LCP

| # | Задача | Ожидаемый эффект |
|---|--------|-----------------|
| 1 | P1.3 — Lazy import PDF/export | Bundle −600 KB |
| 2 | P1.2 — Lazy Leaflet (только на страницах карты) | Bundle −400 KB |
| 3 | P3.1 — Preload hero image | LCP −1–2 с |
| 4 | P3.3 — Font preload + display:swap | FCP −200–300 мс |
| 5 | P1.4 — Lucide icon cleanup | Bundle −60–120 KB |

**Валидация спринта:**
```bash
npm run build:web:prod
npm run analyze:bundle
npm run lighthouse:travel:mobile
npm run lighthouse:travel:desktop
```

### 🟠 Спринт 2 (1 неделя) — Route splitting & RNW

| # | Задача | Ожидаемый эффект |
|---|--------|-----------------|
| 1 | P1.1 — Route-level code splitting (/map, /export) | Entry bundle −40% |
| 2 | P2.1 — RNW slim barrel в production | Unused JS −150 KB |
| 3 | P3.4 — Image optimization (priority, lazy, thumb) | LCP −1–2 с |
| 4 | P5.2 — HTTP cache headers (fonts, images) | Повторные загрузки −60% |

### 🟡 Спринт 3 (1–2 недели) — Runtime & Network

| # | Задача | Ожидаемый эффект |
|---|--------|-----------------|
| 1 | P4.2 — Re-render оптимизация (Zustand selectors) | TBT −50–100 мс |
| 2 | P5.1 — React Query prefetch при hover | Perceived latency −500 мс |
| 3 | P5.3 — API gzip/brotli | Transfer size −40% |
| 4 | P3.2 — Critical CSS inline | FCP −200 мс |

### 🟢 Спринт 4 (2 недели) — Advanced

| # | Задача | Ожидаемый эффект |
|---|--------|-----------------|
| 1 | P3.5 — SSG для /, /search | FCP/LCP −2–3 с |
| 2 | P5.4 — Image CDN | LCP −1–2 с |
| 3 | P4.5 — Web Workers для parsing | TBT −100 мс |
| 4 | P6.5 — Dependency dedup | Bundle −5–10% |

---

## 10. Мониторинг и целевые KPI

### Метрики для отслеживания

| Метрика | Baseline | Target Sprint 1 | Target Sprint 2 | Final Target |
|---------|----------|-----------------|-----------------|--------------|
| Mobile Score (Home) | 65–68 | 70+ | 75+ | 80+ |
| Mobile Score (Search) | 63–65 | 68+ | 73+ | 78+ |
| Mobile Score (Map) | 62–64 | 66+ | 70+ | 75+ |
| Desktop Score (Home) | 92 | 93+ | 95+ | 95+ |
| LCP Mobile (Travel) | 9.7 с | 6.0 с | 4.5 с | ≤ 4.0 с |
| FCP Mobile | 1.7 с | 1.5 с | 1.3 с | ≤ 1.2 с |
| Entry Bundle Size | 4.7 MB | 3.0 MB | 2.5 MB | ≤ 2.0 MB |
| Unused JS | 150–200 KB | 100 KB | 50 KB | ≤ 30 KB |

### Инструменты мониторинга

```bash
# После каждого PR — локальная проверка
npm run build:web:prod
npm run lighthouse:travel:mobile
npm run lighthouse:travel:desktop

# После деплоя — production проверка
yarn lighthouse:produrl:travel:mobile
yarn lighthouse:produrl:travel:desktop
yarn lighthouse:produrl:summary
yarn lighthouse:produrl:lcp

# Bundle analysis
npm run analyze:bundle

# E2E performance budgets
npm run e2e:perf-budget
```

### Alerting thresholds

| Событие | Триггер | Действие |
|---------|---------|----------|
| Mobile score < 60 | Lighthouse CI | Блокировать деплой |
| LCP > 5.0 с | PageSpeed Insights | P0 bug |
| Bundle size > 5 MB | Bundle analyzer | P1 investigation |
| CLS > 0.25 | E2E perf budget | P1 bug |

---

## 11. Anti-patterns (что НЕ делать)

По правилам из `docs/RULES.md`:

1. ❌ **Не добавлять Service Worker** для кэширования страниц/ресурсов
2. ❌ **Не добавлять** `window.location.reload()` для "самовосстановления" после деплоя
3. ❌ **Не ставить** `Cache-Control: immutable` на JS bundles
4. ❌ **Не добавлять** query-param cache busting (`?__r=`, `?__cb=`)
5. ❌ **Не добавлять** pre-hydration "self-heal" скрипты
6. ❌ **Не усложнять** — предпочитать простейшую реализацию
7. ❌ **Не дублировать** — переиспользовать существующие hooks/components
8. ❌ **Не использовать** SVG icon stacks на web

---

## 12. Зависимости между задачами

```
P1.1 (Route splitting)
  ├─→ P1.2 (Lazy Leaflet) — может быть частью route split
  ├─→ P1.3 (Lazy PDF) — может быть частью route split
  └─→ P2.1 (RNW slim) — independent, run in parallel

P3.1 (Hero preload)
  └─→ P3.5 (SSG) — preload headers инжектятся в SSG template

P5.2 (HTTP headers)
  └─→ requires server access (Nginx config), mark as "needs server verification"
```

---

## 13. Риски

| Риск | Вероятность | Влияние | Митигация |
|------|------------|---------|-----------|
| Route splitting ломает navigation | Средняя | Высокое | E2E smoke tests после каждого изменения |
| RNW slim barrel не включает модуль из 3rd-party | Средняя | Среднее | Запустить E2E: home, search, map, travel detail |
| Leaflet lazy load вызывает мигание карты | Низкая | Низкое | Skeleton placeholder на время загрузки |
| SSG pages рассинхрон с SPA routing | Средняя | Среднее | `generate-seo-pages.js` уже обрабатывает shell |
| Nginx path changes break server | Высокая | Критическое | Верификация путей на сервере перед изменениями (RULES.md) |

---

## 14. Чеклист готовности (DoD для каждого изменения)

- [ ] `npm run lint` — ✅ 0 ошибок
- [ ] `npm run test:run` — ✅ все тесты проходят
- [ ] `npm run build:web:prod` — ✅ сборка успешна
- [ ] Lighthouse Mobile Score ≥ текущий baseline
- [ ] Lighthouse Desktop Score ≥ текущий baseline
- [ ] Bundle size ≤ baseline (проверка через `npm run analyze:bundle`)
- [ ] E2E smoke: home, search, map, travel detail — без crash
- [ ] Не нарушены правила кэширования из RULES.md
- [ ] Используются `DESIGN_TOKENS` — без hardcoded значений
- [ ] Проверено в светлой и тёмной теме
- [ ] Проверено на mobile (≤ 390px), tablet (768px), desktop (1280px)

---

*Документ обновлять при завершении каждого спринта. Текущие Lighthouse метрики фиксировать в BASELINE_METRICS.json.*

**Последнее обновление:** 3 марта 2026

