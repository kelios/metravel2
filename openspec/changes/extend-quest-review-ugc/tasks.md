## 1. Снять протухший мок и привести контракт в коде к реальности

- [x] 1.1 Удалить `QUEST_REVIEWS_MOCK` и `buildQuestReviewsMock` из `api/quests.ts`; `fetchQuestReviews` при `404` возвращает пустой список во всех окружениях
- [x] 1.2 Заменить контрактный комментарий над `fetchQuestReviews` (`api/quests.ts`) на фактическое состояние эндпоинта `GET /api/quests/quest{questId}/reviews/` — реализован, проверен пробой
- [x] 1.3 Заменить шапку `api/questReview.ts` («эндпоинта пока нет») на фактический контракт `POST /api/quest-reviews/` и `GET /api/quests/quest{questId}/review/users/{userId}/`
- [x] 1.4 Убрать из `components/quests/QuestReviewSection.tsx` комментарий про «текстовый эндпоинт ещё не на бэке (BE #487)», сохранив описание поведения, которое комментарий объяснял
- [x] 1.5 Показывать «Спасибо за отзыв» только по подтверждённому сервером сохранению: убрать оптимистичную ветку `submittedLocally`, при ошибке показать сообщение (`errorsStatic:api.misc.sendFailed`) и сохранить введённое в форме

## 2. Порог показа агрегированной оценки

- [x] 2.1 Добавить `QUEST_RATING_MIN_REVIEWS = 3` и предикат `hasPublicQuestRating(count)` в `api/questRating.ts`
- [x] 2.2 Применить предикат в оверлейной ветке рейтинга карточки каталога (`screens/tabs/QuestCard.tsx`), не трогая условие показа чипа-читалки
- [x] 2.3 Применить предикат в телефонной ветке деталей карточки (`screens/tabs/QuestCard.tsx`)
- [x] 2.4 Применить предикат в `ratingSlot` страницы квеста (`app/(tabs)/quests/[city]/[questId].tsx`)

## 3. Аналитика отправки отзыва

- [x] 3.1 Создать `utils/questReviewAnalytics.ts` с константой события `quest_review_submit` и обёрткой `trackQuestReviewSubmit({ questId, cityId, rating, hasText })`
- [x] 3.2 Прокинуть `cityId` из `questWizardSections.tsx` через `QuestFinaleFeedback` и `QuestReviewSection` в `useQuestReview`
- [x] 3.3 Вызвать `trackQuestReviewSubmit` в `onSuccess` мутации `hooks/useQuestReview.ts`

## 4. Тесты

- [x] 4.1 Тест `fetchQuestReviews`: непустой ответ адаптируется; `404` и пустой ответ дают пустой список без подстановки отзывов
- [x] 4.2 Тест порога: `hasPublicQuestRating` и обе ветки рейтинга в `QuestCard` (0, 1, 2, 3 отзыва), чип-читалка остаётся при 1 отзыве
- [x] 4.3 Тест аналитики: событие уходит один раз при успешном сохранении с ожидаемыми параметрами и не уходит при ошибке
- [x] 4.4 Прогнать затронутый scope jest и `e2e/quest-reviews-reader.spec.ts` (порог не должен ронять сценарий: фикстура отдаёт `rating_count: 3`)

## 5. Документация и связанные задачи

- [x] 5.1 Обновить `docs/features/quests.md`: снять открытый вопрос «реализованы ли эндпоинты отзывов», зафиксировать порог показа агрегата и событие `quest_review_submit`
- [x] 5.2 Завести `area=back` задачу: фото в отзыве — #1575 (коллекция `questReviewPhoto` в `POST /api/upload`, до 3 фото, поле `photos` в публичном элементе списка)
- [x] 5.3 Завести `area=back` задачу: модерация отзывов — #1576 (флаг по образцу `travels.Travel.moderation`, фильтрация публичного списка и агрегатов)
- [x] 5.4 Завести `area=back` задачу: структурная отметка «точка требует проверки» — #1577 (привязка к `quest_step`, очередь при ≥2 отметках)
- [x] 5.5 Завести фронтовую задачу-продолжение — #1579, `depends_on` #1575/#1576/#1577: пикер до 3 фото, показ фото в читалке, событие `quest_photo_upload`, кнопка «точка изменилась»
- [x] 5.6 Завести задачу на дефект: #1578 фиксирует отсутствующий `/rate/`, тап по звезде и DEV-мок; выбрана консолидация через `POST /api/quest-reviews/`

## 6. Проверка и приёмка

- [x] 6.1 Браузер-проверка на локальном стеке, desktop web (1280): каталог `/quests` — `krakow-podgorze` (1 отзыв) показывает чип-читалку «1» и НЕ показывает оценку; `minsk-cipher` (3 отзыва) показывает «4,7 (3)». Playwright, `app-hydrated` подтверждён
- [x] 6.2 Браузер-проверка на локальном стеке, страница квеста: `minsk-cipher` (3 отзыва) — чип «4,7», aria «Отзывы, рейтинг 4,7 из 5, 3 отзыва»; `krakow-podgorze` (1 отзыв) — чип «1», aria «1 отзыв», оценка скрыта. Читалка открывается в обоих случаях и показывает реальные отзывы из базы (не мок), ошибок в консоли нет
- [x] 6.3 Браузер-проверка mobile web (390), телефонная ветка деталей карточки: `krakow-podgorze` — оценка скрыта, чип «1» на месте; `minsk-cipher` — «4,7». Формат числа локальный («4,7», не «4.7»)
- [x] 6.4 Независимое review-and-fix полного диффа задачи (`review-auditor`): подтверждено две находки и исправлено — `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` на сообщении об ошибке отправки (по образцу `components/forms/FormFieldWithValidation.tsx`) и тест на сценарий «Сохранение отзыва не удалось» в `__tests__/components/quests/QuestReviewSection.test.tsx`. Повторные проверки: jest 84/84, `tsc --noEmit` — ноль диагностик в файлах задачи
- [x] 6.5 `openspec validate extend-quest-review-ugc --strict`
