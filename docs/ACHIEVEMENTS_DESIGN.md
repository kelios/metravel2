# MeTravel Achievements & Ranks — дизайн системы

Геймификация профиля: пользователь получает **значки** (дискретные награды за действия)
и **ранг** (общий уровень по очкам XP). Цель — удержание и мотивация писать статьи,
проходить квесты, путешествовать.

Статус: **дизайн (greenfield)** — ни на фронте, ни на бэке нет ни одной модели
achievement/badge/rank. Спринт: «Achievements & Ranks (Геймификация)».

Решения (зафиксированы с владельцем 2026-06-20):
- Механика: **значки + ранг (XP)**.
- Визуал значков: **премиум объёмные медали** (металлик/градиент, тиры бронза→платина).
- Видимость: **свой профиль + публичный профиль автора + AuthorCard** (без лидерборда в v1).
- Месячные челленджи — phase-2 эпик, низкий приоритет.

---

## 1. Модель данных (бэкенд — новое Django-приложение `achievements/`)

Бэкенд — отдельное репо `../metravel-backend` (владелец Sergey). Здесь только спека для тикетов.

### `BadgeCategory`
Справочник категорий значков (для группировки в UI).
- `name`, `slug`, `order`, `icon` (опц.)

### `Badge` — определение значка
- `name`, `slug`, `description`
- `category` → FK `BadgeCategory`
- `tier`: enum `none|bronze|silver|gold|platinum|legendary`
- `image`: `ImageField(storage=get_storage_engine(), upload_to=badge_image_upload_to)` → S3
  (тот же паттерн, что аватары/квест-обложки). **Картинку заполняет автоматический
  AI-пайплайн генерации на бэке (BE-A8), не человек.** Админ может перегенерировать
  или загрузить оверрайд вручную, но это исключение, не основной поток.
- `image_status`: enum `pending|generating|ready|failed` — состояние AI-генерации картинки
- `image_prompt`: text — промпт/параметры, по которым AI сгенерил медаль (для воспроизводимости)
- `criteria_type`: enum — что считаем:
  `registered | profile_completed | travels_published | travels_in_category |
   quests_completed | quests_city_complete | likes_received | subscribers_count |
   countries_visited | monthly_travels | monthly_quests`
- `criteria_params`: JSONField — пороги/привязки, напр. `{"threshold": 5}` или
  `{"threshold": 10, "category_id": 3}` или `{"transport_id": 2}`
- `points`: int — сколько XP даёт разблокировка
- `is_active`, `order`, `is_secret` (скрытый до получения)

### `UserBadge` — факт разблокировки
- `user` → FK, `badge` → FK (`unique_together = (user, badge)`)
- `earned_at`
- `progress_snapshot`: JSONField (опц. — значение метрики на момент выдачи)

### `UserRank` — денормализованный снапшот ранга (OneToOne к User)
- `total_points`, `level`, `title`
- `badges_count`, `recomputed_at`

### `RankLevel` — справочник уровней
| level | title | min_points |
|-------|-------|-----------|
| 1 | Новичок | 0 |
| 2 | Турист | 50 |
| 3 | Путешественник | 150 |
| 4 | Бывалый | 400 |
| 5 | Писатель | 900 |
| 6 | Эксперт | 1800 |
| 7 | Легенда | 3500 |

(пороги правятся в админке без релиза)

---

## 2. Источники метрик (что считаем из существующих данных)

Без новых полей в чужих моделях — читаем то, что уже есть:

| Метрика | Источник (backend) |
|---------|--------------------|
| Опубликованные travel | `Travel.objects.filter(users__id=uid, publication_status='published').count()` |
| По теме/категории | `TravelCategory.filter(travel__users__id=uid, travel__publication_status='published')` (аналогично `transports`) |
| Пройденные квесты | `QuestProgress.objects.filter(user_id=uid, completed=True).count()` |
| Квесты по городу | `QuestProgress(completed=True).quest__city` |
| Лайки получены | `TravelLike` по своим travel |
| Подписчики | модель подписок |
| Страны посещены | `TravelCountry` / `UserTravelStatus(status='visited')` |
| Профиль заполнен | `Profile` — заполнены имя/аватар/соцсети |

## 3. XP — начисление

XP = сумма `points` всех разблокированных значков. (Простая, прозрачная модель: очки
неотделимы от значков; уровень = функция от суммы.) Альтернатива — отдельные XP за каждое
действие — отложена, усложняет аудит.

---

## 4. Движок вычислений (`AchievementEngine`)

Единая точка: `AchievementEngine.evaluate(user)`:
1. Считает все метрики пользователя (раздел 2).
2. Проходит активные `Badge`, сравнивает метрику с `criteria_params`.
3. Создаёт недостающие `UserBadge` (idempotent), собирает список «только что выданных».
4. Пересчитывает `UserRank` (сумма points → level/title по `RankLevel`).
5. Возвращает newly-earned (для тоста на фронте).

**Триггеры** (гибрид, т.к. на бэке нет Celery/cron/signals — всё ставится с нуля):
- Django-сигналы `post_save` на `TravelUser` (публикация), `QuestProgress` (completed),
  `TravelLike` → точечный `evaluate(user)`. Подключить `signals.py` + `apps.ready()`.
- Management-команда `recalculate_achievements [--user ID]` — бэкафилл существующих
  пользователей и периодическая сверка (можно повесить на cron-сервис в compose).

---

## 5. API (DRF, роутер `achievements`) — РЕАЛИЗОВАНО на origin/master

Фактический контракт (achievements/serializers.py, views.py). FE-адаптер
`api/achievements.ts` приведён к нему.

- `GET /api/achievements/badges/` — `PublicBadgeSerializer[]`. Поля значка:
  `{id, name, slug, description, category{id,name,slug,order,icon}, tier, image_url,
  image_status, points, order}`. `image_url` = `''` когда картинки нет (FE → null).
- `GET /api/achievements/me/` (Token) →
  `{ rank, rank_levels, earned_badges, progress, recently_earned }`:
  - `rank` = `{level, title, total_points, badges_count, recomputed_at}` — **без порогов**.
  - `rank_levels` = `[{level, title, min_points}]` — пороги уровней (FE сам считает
    прогресс к следующему уровню из rank + rank_levels).
  - `earned_badges` = `[{id, badge, period, earned_at, progress_snapshot}]`.
  - `progress` = `[{badge, current, threshold, period}]` (незакрытые значки).
  - `recently_earned` = earned за последние 24ч (для тоста).
- `GET /api/achievements/user/{user_id}/` — публично:
  `{ rank, earned_badges }`. **rank_levels НЕ отдаёт** → публичный RankBar показывает
  уровень+титул+очки без XP-полосы (см. BE-A10 ниже, чтобы добавить полосу).
- TODO: rank-summary в `GET /api/user/{pk}/profile/` — пока НЕ реализован (опц.,
  FE и так берёт ранг из achievements-эндпоинтов).

---

## 6. Django admin

- `BadgeAdmin`: `criteria_type`+`criteria_params`, `points`, `tier`, `category`,
  `is_active`, `order`, `image_status`, превью картинки + **action «Перегенерировать
  картинку»** (повторно дёргает AI-пайплайн BE-A8). Ручная загрузка `image` доступна
  как оверрайд, но картинки по умолчанию генерит AI, а не человек. Админ может
  добавлять новые значки и менять пороги без релиза — картинка сгенерится автоматически.
- `BadgeCategoryAdmin`, `RankLevelAdmin`.
- `UserBadge` — readonly inline/list для аудита выдач.

## 7. Seed + AI-генерация картинок значков (бэкенд)

**Картинки значков генерирует и заливает сам бэкенд через AI-модель — без ручного
труда ни со стороны человека, ни заранее заготовленных артов.**

Пайплайн (BE-A8):
1. `seed_badges` (data-миграция/команда) создаёт строки `Badge` (имя, критерий, tier,
   `points`) со `image_status='pending'`. Картинок ещё нет.
2. Сервис `BadgeImageGenerator` строит промпт из `name`+`tier`+`category` (единый стиль:
   премиум объёмные металлик-медали, бронза→легендарная, прозрачный фон, ≥2x),
   зовёт AI image-модель (провайдер — на выбор владельца бэка), получает PNG.
3. Постобработка (кроп/прозрачность/ресайз) → запись в `Badge.image` (S3),
   `image_status='ready'`. При ошибке — `failed` + ретрай.
4. Запуск: management-команда `generate_badge_images [--badge ID] [--regenerate]`
   (и admin-action «Перегенерировать»). Идемпотентно: уже `ready` пропускаются, если
   нет `--regenerate`. Можно повесить на тот же cron-сервис, что и пересчёт достижений.

Поскольку картинка может быть ещё `pending`/`failed`, API отдаёт `image_url=null` —
фронтовый `BadgeMedal` уже рисует процедурную медаль как фолбэк, так что UI не ломается,
пока генерация догоняет.

Стартовый набор (~25 значков), для которых генерятся картинки:

- **Онбординг**: Добро пожаловать (registered), Профиль готов (profile_completed),
  Первые шаги (1 публикация), Первый квест (1 квест).
- **Автор** (travels_published, тиры): 5 / 15 / 30 / 60 / 100 →
  Бронзовый…Легендарный автор.
- **Тематические** (travels_in_category/transport, bronze 3 / silver 10 / gold 25):
  Хайкер, Велопутешественник, Автотурист, Водник, Городской исследователь.
- **Квесты**: Квест-новичок 1 / Искатель 5 / Мастер 15 / Легенда 30;
  Покоритель города (все квесты города).
- **Социальные**: Любимец публики (лайки 50/250/1000), Кумир (подписчики 10/50/200).
- **Гео**: Турист 1 / Странник 5 / Гражданин мира 15 стран.
- **Phase-2 (месячные)**: Активный месяц (3 публикации/мес), Походник месяца (3 квеста/мес).

---

## 8. Фронтенд

### API-слой
- `api/achievements.ts` — типы `Badge`, `UserBadge`, `UserRank`, `BadgeProgress`,
  `AchievementsResponse`.
- `api/achievements/Queries.ts` — `fetchBadges`, `fetchMyAchievements`,
  `fetchUserAchievements(userId)` (паттерн `apiClient` + `Authorization: Token`).
- `queryKeys`: `achievements.badges()`, `achievements.me()`, `achievements.user(id)`.

### Компоненты `components/achievements/`
- `BadgeMedal.tsx` — один значок: картинка из S3 + tier-ring + earned/locked + tooltip.
  Картинка значка рендерится через `ImageCardMedia` (или согласованную обёртку) —
  прямой `expo-image` запрещён ESLint-гвардом. RN Web + native.
- `BadgeGrid.tsx` — сетка значков (earned + locked с прогресс-кольцом).
- `RankBar.tsx` — уровень/титул + прогресс-бар XP до следующего уровня.
- `AchievementsSection.tsx` — блок в профиле: RankBar + топ-значки + «Все достижения».
- `AchievementsGalleryModal` — полная галерея с группировкой по категориям и прогрессом.
- `BadgeUnlockToast.tsx` — «Новый значок!» после действия (свой профиль).

### Интеграция
- `app/(tabs)/profile.tsx` / `components/profile/` — секция достижений (свои, с прогрессом).
- `app/(tabs)/user/[id].tsx` — секция достижений (публично, только earned).
- `components/travel/AuthorCard.tsx` — компактный ранг-бейдж + 2–3 топ-значка.
- (опц., low) `components/ui/UnifiedTravelCard.tsx` — micro-rank автора.

### Правила проекта
- Изображения значков — через `ImageCardMedia`/обёртку (гвард).
- Серверный стейт — React Query; клиентский — Zustand; алиас `@/`; TS strict, без `any`
  в `api/`/`hooks/`/`stores/`. RN Web-совместимость для всех общих компонентов.

---

## 9. Зависимости задач

```
BE-A1 (модели) ─┬─ BE-A2 (движок) ─┬─ BE-A3 (сигналы + бэкафилл)
                │                  └─ BE-A4 (API) ──────────────┐
                ├─ BE-A5 (admin)                                │
                └─ BE-A6 (seed строк Badge) ─→ BE-A8 (AI-генерация картинок → S3)
                                                                │
FE-A1 (api-слой, по контракту BE-A4) ───────────────────────────┘
  ├─ FE-A2 (BadgeMedal/Grid) ── FE-A4 (секция+галерея профиля)
  ├─ FE-A3 (RankBar)            FE-A5 (публичный профиль)
  │                             FE-A6 (AuthorCard)
  ├─ FE-A7 (unlock toast)
  └─ FE-A9 (тесты)
OWN-A1 (миграции + запуск AI-генерации значков на проде)
```

FE может стартовать на моках контракта параллельно с бэком; финальная склейка — после BE-A4.

---

## 10. Peer-awarded badges (награды от сообщества)

Помимо авто-значков (за критерий), пользователи **сами выдают значки** другим —
«Любимый автор», «Лучшая статья», «Вдохновил меня» и т.п. Социальное признание.

### Концепция
- Значок получает новый признак `award_type`: `auto` (существующие, за критерий) или
  `peer` (выдаются людьми). У peer-значков нет `criteria_*` — они **grantable**.
- `target` peer-значка: `user` (даётся автору — «Любимый автор») или `travel`
  (даётся путешествию/статье — «Лучшая статья», «Лучшие фото»).
- Выдача — **toggle** (как лайк): дал/забрал. Нельзя себе. Один грант на
  `(giver, badge, recipient|travel)`.
- Отображается **счётчиком**: «Любимый автор ×42». На профиле/в карточке travel.

### Данные (бэк)
- `Badge.award_type` enum `auto|peer` (default auto); `Badge.target` enum `user|travel`
  (для peer). У peer-значков `criteria_type` не задаётся.
- `PeerBadgeGrant`: `giver` FK, `badge` FK(award_type=peer), `recipient_user` FK(null),
  `travel` FK(null), `created_at`. `UniqueConstraint(giver, badge, recipient_user, travel)`.
  CHECK: ровно один из `recipient_user`/`travel` непустой; `giver != recipient_user`.
- Агрегация: счётчик грантов по `(badge, recipient|travel)`.

### XP / ранг
v1: peer-значки **prestige-only, 0 XP** — НЕ влияют на ранг (анти-фарминг взаимными
выдачами). Поле `points` у peer-значка = 0. (Позже можно дать малые очки с дневным
капом — но не в v1.)

### API
- `GET /api/achievements/peer-badges/` — каталог grantable peer-значков (раздельно по target).
- `POST /api/achievements/peer-badges/grant/` `{badge_slug, recipient_id?|travel_id?}` —
  toggle; ответ `{granted: bool, count: int}`. Auth. Анти-абьюз: no-self, unique, rate-limit.
- `GET /api/achievements/user/{id}/` → расширить `peer_received: [{badge, count,
  granted_by_me}]` (granted_by_me — относительно текущего зрителя).
- `GET /api/achievements/travel/{id}/` → `{peer_received: [{badge, count, granted_by_me}]}`.

### Стартовый набор peer-значков
- **target=user**: Любимый автор, Вдохновил меня, Лучший рассказчик, Открытие.
- **target=travel**: Лучшая статья, Лучшие фото, Хочу повторить, Самый полезный.

Картинки — тем же AI-пайплайном (BE-A8 / [ACHIEVEMENTS_BADGE_PROMPTS.md](ACHIEVEMENTS_BADGE_PROMPTS.md));
до готовности — процедурный фолбэк `BadgeMedal`.

### Фронт
- `api/achievements.ts`: типы `PeerBadge`, `PeerBadgeReceived`; `fetchPeerBadgeCatalog`,
  `grantPeerBadge(badgeSlug, target)` (mutation), `peer_received` в user/travel ответах.
- Хуки: `usePeerBadgeCatalog`, `useGrantPeerBadge` (оптимистичный toggle),
  `useUserAchievements`/`useTravelPeerBadges` отдают `peerReceived`.
- Компоненты `components/achievements/`: `PeerBadgePickerSheet` (лист grantable + toggle),
  `PeerBadgeGiveButton`, `PeerBadgeReceivedRow` (медали со счётчиком).
- Интеграция: публичный профиль (`user/[id]`) — «Наградить автора» (target=user) +
  полученные; travel-detail — «Наградить статью» (target=travel) + полученные
  (через travel-expert); свой профиль — блок «От сообщества» (read-only).
- Гейт: только авторизованный; на своём профиле/своём travel кнопку «наградить» прятать.
