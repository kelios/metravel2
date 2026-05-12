# Фича: Календарь путешествий

**Последняя актуализация:** 2026-05-12
**Статус:** ✅ v1 реализован — локальное хранение, фронт готов

## TL;DR

Персональный календарь, где пользователь видит все свои путешествия по трём статусам: **Был**, **Планирую** (с датой), **Хочу** (без даты). Статус назначается со страницы путешествия.

---

## Точки входа

| Путь | Назначение |
|------|-----------|
| `app/(tabs)/calendar.tsx` | 🆕 Новый экран календаря |
| `app/(tabs)/travels/[param].tsx` | Существующая страница путешествия — добавляется кнопка смены статуса |
| `app/(tabs)/profile.tsx` | Существующий профиль — добавляется ссылка на `/calendar` |

---

## Три статуса путешествия

| Статус | Ключ | Иконка (Feather) | Описание |
|--------|------|-----------------|----------|
| Был | `visited` | `check-circle` | Уже посетил, дата опциональна (ретроспективно) |
| Планирую | `planned` | `calendar` | Конкретная дата поездки, отображается в сетке |
| Хочу | `wishlist` | `bookmark` | Без даты, простой вишлист |

---

## Дерево компонентов

```
<CalendarScreen>                          # app/(tabs)/calendar.tsx
 ├─ <ProfileCollectionHeader>             # существующий, reuse
 ├─ <StatusTabBar>                        # 🆕 переключатель Был / Планирую / Хочу
 ├─ <MiniCalendar>                        # 🆕 компоненты/calendar/MiniCalendar.tsx
 │   └─ показывается только при "Планирую"
 │   └─ дни с поездками помечены точкой
 └─ <TravelStatusList>                    # список карточек
     └─ <TabTravelCard>                   # существующий, reuse

<TravelStatusButton>                      # 🆕 components/travel/TravelStatusButton.tsx
 └─ встраивается в детальную страницу путешествия
 └─ показывает текущий статус (или нейтральное состояние)
 └─ при тапе открывает <StatusPicker> (Modal/ActionSheet)
 └─ при выборе "Планирую" — показывает date picker
```

| Файл | Зона ответственности |
|------|---------------------|
| `stores/travelStatusStore.ts` | 🆕 Zustand-стор: хранение статусов, CRUD, AsyncStorage |
| `components/calendar/MiniCalendar.tsx` | 🆕 Сетка месяца без внешних зависимостей |
| `components/travel/TravelStatusButton.tsx` | 🆕 Кнопка смены статуса для детальной страницы |
| `app/(tabs)/calendar.tsx` | 🆕 Экран с табами + calendar + список |

---

## Данные

### Клиентский стейт (Zustand) — только фронт, v1

```typescript
// stores/travelStatusStore.ts
type TravelStatusEntry = {
  id: string | number
  type: 'travel'
  title: string
  imageUrl?: string
  url: string
  country?: string
  city?: string
  status: 'visited' | 'planned' | 'wishlist'
  plannedDate?: string   // ISO "YYYY-MM-DD", только для status === 'planned'
  visitedDate?: string   // ISO "YYYY-MM-DD", опционально для status === 'visited'
  addedAt: number        // timestamp
}
```

Действия стора:
- `setStatus(entry)` — создать / обновить запись
- `removeStatus(id)` — удалить запись
- `getStatus(id)` — получить текущий статус
- `getByStatus(status)` — список по статусу
- `getByMonth(year, month)` — записи со статусом `planned` в конкретном месяце
- `loadLocal(userId)` — загрузить из AsyncStorage при старте
- `persistLocal(userId)` — сохранить в AsyncStorage

Хранилище: `AsyncStorage`, ключ `metravel_travel_status_{userId}`.

### Серверный стейт (React Query) — v2, требует бэкенда

В v1 только локальное хранение. В v2 синхронизация через API (см. раздел «Что нужно от бэкенда»).

---

## Поток данных (v1, только фронт)

```
Страница путешествия
  → TravelStatusButton (нажатие)
  → StatusPicker (выбор статуса + дата)
  → travelStatusStore.setStatus(entry)
  → AsyncStorage.setItem(...)
  ← обновление UI во всех подписчиках

Экран /calendar
  → travelStatusStore.getByStatus(activeTab)
  → список карточек TabTravelCard
  → MiniCalendar (если activeTab === 'planned')
     → travelStatusStore.getByMonth(year, month)
     → выделенные дни
```

---

## Что нужно реализовать на фронтенде

### ✅ Обязательно (v1 — локальное хранение)

- [x] **`stores/travelStatusStore.ts`**
  - Zustand-стор с AsyncStorage-персистом
  - Типы `TravelStatusEntry`, `TravelStatus`
  - CRUD-методы: setStatus, removeStatus, getStatus, getByStatus, getByMonth
  - Загрузка при старте (аналогично `viewHistoryStore.ts`)

- [x] **`components/calendar/MiniCalendar.tsx`**
  - Чистый React Native, без внешних календарных либ
  - Отображает текущий/выбранный месяц (сетка 7×6)
  - Навигация по месяцам (стрелки prev/next)
  - Дни с запланированными поездками помечены цветной точкой (`DESIGN_TOKENS`)
  - Тап по дню — callback с датой для ф��льтрации списка
  - Поддержка web + native

- [x] **`components/travel/TravelStatusButton.tsx`**
  - Кнопка с иконкой Feather и текстом текущего статуса
  - При отсутствии статуса: нейтральная кнопка «Добавить в план»
  - Тап открывает `Modal` с тремя вариантами
  - При выборе `planned`: появляется date picker
    - Web: `<input type="date">` через нативный HTML (Platform.OS === 'web')
    - Native: TextInput с форматом YYYY-MM-DD
  - Использует `useRequireAuth` (аналогично `FavoriteButton.tsx`)
  - Toast-уведомление при смене статуса

- [x] **`app/(tabs)/calendar.tsx`**
  - SafeAreaView + ProfileCollectionHeader («Мой календарь»)
  - Авторизация-гейт (EmptyState с кнопкой «Войти» если не авторизован)
  - `StatusTabBar`: три таба — Был / Планирую / Хочу
  - При табе «Планирую»: `MiniCalendar` над списком, активный день фильтрует список
  - Список карточек через `TabTravelCard` (reuse)
  - Пустые состояния для каждого таба (`EmptyState`, reuse)
  - SEO: `robots="noindex, nofollow"` (персональная страница)

- [x] **`app/(tabs)/_layout.tsx`**
  - Добавлено `<Tabs.Screen name="calendar" options={HIDDEN} />`

- [x] **`app/(tabs)/profile.tsx`**
  - Маршрут `/calendar` добавлен в `handleQuickAction`

- [x] **`components/profile/ProfileQuickActions.tsx`**
  - Добавлена карточка «Календарь» (ключ `calendar`, иконка `calendar`)

- [x] **`components/travel/CTASection.tsx`**
  - Встроен `TravelStatusButton` под кнопкой «В избранное»

- [x] **`components/layout/AppProvidersDeferredRuntime.tsx`**
  - `travelStatusStore.loadLocal` вызывается при старте приложения

### 🔁 Опционально (v2 — после появления API)

- [ ] `api/travelStatus.ts` — клиент для серверных эндпоинтов
- [ ] `api/travelStatusQueries.ts` — React Query hooks (useQuery + useMutation)
- [ ] Синхронизация локального состояния с сервером при логине
- [ ] Конфликт-резолюшн локаль vs. сервер (prefer server)
- [ ] Offline-queue для изменений статусов

---

## Что нужно от бэкенда (сейчас отсутствует)

### 🔴 Критично для v2 (серверная синхронизация)

#### 1. CRUD для статусов путешествий

```
GET    /api/user/{id}/travel-statuses/
       → [{travel_id, status, planned_date, visited_date, added_at}, ...]

POST   /api/user/{id}/travel-statuses/
       Body: {travel_id, status, planned_date?, visited_date?}
       → 201 Created, возвращает созданную запись

PATCH  /api/user/{id}/travel-statuses/{travel_id}/
       Body: {status?, planned_date?, visited_date?}
       → 200 OK, обновлённая запись

DELETE /api/user/{id}/travel-statuses/{travel_id}/
       → 204 No Content
```

#### 2. Фильтрация по месяцу (для производительности)

```
GET /api/user/{id}/travel-statuses/?status=planned&year=2026&month=6
    → [{...}]  — только поездки в нужном месяце
```

#### 3. Схема записи статуса

```json
{
  "travel_id": 123,
  "status": "planned",          // "visited" | "planned" | "wishlist"
  "planned_date": "2026-07-15", // nullable, только для planned
  "visited_date": "2025-09-01", // nullable, опционально для visited
  "added_at": "2026-05-12T10:00:00Z",
  "updated_at": "2026-05-12T10:00:00Z",
  "travel": {                   // вложенный объект для отображения без доп. запроса
    "id": 123,
    "name": "Alps hike",
    "slug": "alps-hike",
    "url": "/travels/alps-hike",
    "travel_image_thumb_url": "...",
    "countryName": "Switzerland"
  }
}
```

#### 4. Валидация на бэкенде

- `planned_date` обязателен при `status === "planned"`
- `planned_date` должна быть в формате ISO date (`YYYY-MM-DD`)
- `status` — enum из трёх значений
- Уникальность: один пользователь + один `travel_id` → одна запись (upsert-семантика)

### 🟡 Желательно

#### 5. Bulk-sync эндпоинт (для синхронизации после оффлайн-работы)

```
POST /api/user/{id}/travel-statuses/bulk-sync/
     Body: [{travel_id, status, planned_date?, visited_date?, updated_at}]
     → {created: [...], updated: [...], conflicts: [...]}
```

#### 6. Статус в ответе детального путешествия

Добавить в `GET /api/travels/{id}/` поле:

```json
{
  "user_status": {
    "status": "planned",
    "planned_date": "2026-07-15"
  }
}
```

Это позволит TravelStatusButton сразу знать текущий статус без отдельного запроса.

### 🟢 Опционально / будущее

- Push-уведомления за N дней до `planned_date`
- Экспорт в `.ics` (iCalendar) через `GET /api/user/{id}/travel-statuses/export.ics`
- Статистика: количество стран/путешествий по статусам

---

## Зависимости (v1, только фронт)

- Нет новых npm-пакетов
- `@react-native-community/datetimepicker` — уже в expo (входит в Expo SDK)
- Иконки: `@expo/vector-icons/Feather` (уже используется)
- Хранение: `AsyncStorage` (уже используется в `favoritesStore`, `viewHistoryStore`)
- Цвета: `DESIGN_TOKENS` из `constants/designSystem.ts`

---

## Тесты

- Unit: `__tests__/stores/travelStatusStore.test.ts` — CRUD, persist
- Unit: `__tests__/components/calendar/MiniCalendar.test.tsx` — рендер, навигация
- Unit: `__tests__/components/travel/TravelStatusButton.test.tsx` — auth-гейт, выбор статуса
- E2E: `e2e/calendar.spec.ts` — открытие, переключение табов, добавление статуса

---

## Порядок реализации

```
1. stores/travelStatusStore.ts              ← фундамент, всё зависит от него
2. components/calendar/MiniCalendar.tsx     ← визуальный компонент независим
3. components/travel/TravelStatusButton.tsx ← зависит от стора
4. app/(tabs)/calendar.tsx                  ← зависит от стора и MiniCalendar
5. Подключение в _layout.tsx и profile.tsx  ← роутинг и навигация
6. Встройка TravelStatusButton в детали     ← последнее, чтобы не сломать existing
7. (v2) api/travelStatus.ts + Queries       ← после появления API на бэке
```

---

## Известные ограничения v1

- Статусы хранятся локально — не синхронизируются между устройствами
- Без серверного хранения нет истории изменений
- При разлогине / очистке данных статусы теряются (аналогично текущему поведению `favorites` без auth)

---

## Связанные документы

- `docs/README.md` — API-эндпоинты `user/{id}/favorite-travels/`, `user/{id}/history/`
- `docs/ARCHITECTURE.md` — паттерн Zustand + AsyncStorage
- `docs/RULES.md` — правила иконок, цветов, external links
- `stores/viewHistoryStore.ts` — образец для travelStatusStore
- `stores/favoritesStore.ts` — образец оптимистичного обновления + server sync
- `components/travel/FavoriteButton.tsx` — образец для TravelStatusButton

