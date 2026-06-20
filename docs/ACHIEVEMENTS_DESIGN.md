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
  (тот же паттерн, что аватары/квест-обложки; админ грузит/заменяет картинку из коробки)
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

## 5. API (DRF, новый роутер `achievements`)

- `GET /api/achievements/badges/` — справочник активных значков (для галереи; включает
  ещё не полученные, кроме `is_secret`).
- `GET /api/achievements/me/` — свои значки + ранг + **прогресс к незакрытым**
  (`{badge, current, threshold}`) + recently-earned.
- `GET /api/achievements/user/{user_id}/` — публично: только earned + ранг (без прогресса).
- Расширить эндпоинт профиля (`GET /api/user/{pk}/profile/`) кратким rank-summary
  (`level`, `title`, `total_points`, `badges_count`), чтобы не делать лишний запрос
  в шапке/AuthorCard.

---

## 6. Django admin

- `BadgeAdmin`: image-upload, `criteria_type`+`criteria_params`, `points`, `tier`,
  `category`, `is_active`, `order`. **Админ может дозагружать новые значки и менять
  пороги без релиза.**
- `BadgeCategoryAdmin`, `RankLevelAdmin`.
- `UserBadge` — readonly inline/list для аудита выдач.

## 7. Seed стартового набора

Data-миграция или `seed_badges` management-команда + заливка сгенерированных картинок
в S3. Стартовый набор (~25 значков):

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
                └─ BE-A6 (seed + картинки) ←── DES-A1 (генерю медали)
                                                                │
FE-A1 (api-слой, по контракту BE-A4) ───────────────────────────┘
  ├─ FE-A2 (BadgeMedal/Grid) ── FE-A4 (секция+галерея профиля)
  ├─ FE-A3 (RankBar)            FE-A5 (публичный профиль)
  │                             FE-A6 (AuthorCard)
  ├─ FE-A7 (unlock toast)
  └─ FE-A9 (тесты)
OWN-A1 (миграции + заливка значков на прод)
```

FE может стартовать на моках контракта параллельно с бэком; финальная склейка — после BE-A4.
