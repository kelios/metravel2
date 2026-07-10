# Фича: Календарь путешествий

**Последняя актуализация:** 2026-07-10
**Статус:** ✅ реализован — explicit статусы синхронизируются с API, авторские опубликованные путешествия добавляются как default `Был`

## TL;DR

Персональный календарь, где пользователь видит все свои авторские путешествия и личные статусы по трём разделам: **Был**, **Планирую** (с датой), **Хочу** (без даты). Авторские опубликованные путешествия по умолчанию считаются **Был**; личный explicit status, выбранный пользователем, имеет приоритет.

Правило дат для **Был**: если есть точная `visited_date`, показываем её; если точной даты нет, но у путешествия есть месяц и год, фронт детерминированно раскладывает запись на выходные этого месяца. Если explicit status отсутствует, опубликованное авторское путешествие попадает в **Был** как default-запись.

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

### Клиентский стейт (Zustand + API merge)

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

При загрузке авторизованного пользователя стор объединяет:
- explicit записи из `GET /api/user/{id}/travel-statuses/`;
- опубликованные авторские путешествия из списка “Мои путешествия” как default `visited`.

Если один и тот же travel есть в explicit status и в авторском списке, explicit status побеждает, а metadata путешествия (`year`, `month`, `monthName`, обложка, страна) используется для календарного fallback.

### Серверный стейт

Explicit статусы синхронизируются через `GET/POST/PATCH/DELETE /api/user/{id}/travel-statuses/`. Default `visited` для авторских путешествий вычисляется на фронте из существующего списка travel и не требует отдельной backend-миграции.

---

## Поток данных

```
Страница путешествия
  → TravelStatusButton (нажатие)
  → StatusPicker (выбор статуса + дата)
  → travelStatusStore.setStatus(entry)
  → AsyncStorage.setItem(...)
  ← обновление UI во всех подписчиках

Экран /calendar
  → travelStatusStore.loadLocal(userId)
     → local cache
     → /user/{id}/travel-statuses/ explicit statuses
     → /travels/?where.user_id=... authored travels as default visited
     → merge: explicit status wins, authored metadata enriches fallback dates
  → travelStatusStore.getByStatus(activeTab)
  → список карточек TabTravelCard
  → MiniCalendar (если activeTab === 'planned')
     → travelStatusStore.getByMonth(year, month)
     → выделенные дни
```

---

## Что нужно реализовать на фронтенде

### ✅ Обязательно

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

### 🔁 Опционально / будущее

- [ ] Конфликт-резолюшн локаль vs. сервер (prefer server)
- [ ] Offline-queue для изменений статусов

---

## Backend contract

### Explicit status CRUD

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

## Зависимости

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
7. Серверная синхронизация explicit статусов ← уже реализована через `api/user`
```

---

## Известные ограничения

- Default `Был` для авторских путешествий вычисляется на фронте и не создаёт explicit status на сервере.
- Если explicit status есть, он побеждает default `Был`.
- Если у `Был` нет точной `visited_date`, календарь использует детерминированный fallback по месяцу и году путешествия.

---

## Связанные документы

- `docs/README.md` — API-эндпоинты `user/{id}/favorite-travels/`, `user/{id}/history/`
- `docs/ARCHITECTURE.md` — паттерн Zustand + AsyncStorage
- `docs/RULES.md` — правила иконок, цветов, external links
- `stores/viewHistoryStore.ts` — образец для travelStatusStore
- `stores/favoritesStore.ts` — образец оптимистичного обновления + server sync
- `components/travel/FavoriteButton.tsx` — образец для TravelStatusButton
