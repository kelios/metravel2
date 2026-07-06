# Черновики travel-визарда: как это устроено (load-bearing)

Локальные черновики — это **третий** слой сохранения, поверх контракта save/moderation
(`docs/TRAVEL_SAVE_MODERATION_CONTRACT.md`). Слои не путать:

| Слой | Где живёт | Кто пишет | Кто чистит |
|---|---|---|---|
| Серверный upsert (`saveFormData`) | бэкенд | автосейв (5с дебаунс) + ручной «Сохранить» | — |
| Автосейв-стейт (`useImprovedAutoSave`) | память | `useTravelFormPersistence` | сам |
| **Локальный черновик** | `localStorage` (web) / `AsyncStorage` (native) | `useDraftRecovery.saveDraft` (2с дебаунс) | `clearDraft` / TTL 24ч / авто-очистка при эквивалентности |

## Ключи хранилища

- `metravel_travel_draft_new` — создание нового travel (до первого сейва).
- `metravel_travel_draft_<id>` — существующий travel.
- Пока id не отрезолвился у существующего travel — ключ `null`, черновик **не** пишется
  и **не** читается (защита от осиротевших `_null`-черновиков, тикет #171/172).
- При переходе `_new` → `_<id>` (первый сейв нового travel, F-09) старый ключ и
  pending-дебаунс уничтожаются — иначе ложный диалог после reload.
- Формат: `{ data: TravelFormData (stripUndefinedDeep), timestamp: Date.now() }`.

## Когда черновик пишется

Эффект в `components/travel/upsert/useUpsertTravelController.ts`:
`form.formData` изменился **И** `formState.isDirty` **И** `hasUserInteracted`
**И** автосейв не в статусе `saving`/`saved` → `saveDraft(formData)` (дебаунс 2с).
На web дополнительно `flushDraft` по `pagehide`/`visibilitychange` — мгновенная запись
последнего pending-снапшота при уходе со страницы.

Ловушки (обе реальные, обе — источники «фантомных» черновиков):
- `isDirty` — это **структурный** deep-equal с baseline формы. Программные мутации
  (async `rehydrateMarkerIdsFromServer` после успешного сейва делает
  `updateField('coordsMeTravel', …)`) делают форму «dirty» без правок пользователя.
- `hasUserInteracted` — липкий на всю сессию: один введённый символ в начале сессии
  разрешает запись черновиков до конца сессии, в т.ч. после успешного сейва.

Итог: после ручного сейва (`saveAndClearDraft` → `clearDraft`) rehydrate может
**перезаписать черновик заново** — данными, которые семантически равны серверным.
Это штатно нейтрализуется на следующем открытии (см. «Сравнение»).

## Когда черновик чистится

- `clearDraft`: после успешного ручного сейва (`saveAndClearDraft`) и по
  `autosave.status === 'saved'`; отменяет pending-дебаунс и `pendingDraftDataRef`.
- TTL: черновик старше 24ч удаляется молча при проверке.
- Авто-очистка: черновик, **смыслово эквивалентный** текущим данным, удаляется молча.
- `dismissDraft` («Открыть сохранённую») и `recoverDraft` («Продолжить с черновика»)
  удаляют черновик из хранилища.
- Если пользователь закрыл вкладку, не ответив на диалог, — черновик остаётся и диалог
  появится снова (осознанно: генуинный черновик терять нельзя).

## Диалог восстановления

`components/travel/DraftRecoveryDialog.tsx`, показывается из `UpsertTravelView` по
`draftRecovery.hasPendingDraft`. Решение принимает mount-check эффект в
`hooks/useDraftRecovery.ts`: читает черновик по ключу → TTL → **смысловое сравнение** с
`currentData` (гидрированная форма). Проверка выполняется один раз на ключ
(`comparedDraftKeyRef`) — последующие изменения `currentData` (автосейв) диалог не
реанимируют. `enabled` = авторизован ∧ загрузка завершена ∧ есть доступ ∧ нет ошибки
загрузки — против пустой/чужой формы сравнение не запускается.

## Сравнение «черновик vs сервер» — контракт (главное место)

`extractDraftComparable` в `hooks/useDraftRecovery.ts`. Черновик и серверные данные
проходят РАЗНЫЕ пайплайны нормализации (GET → `transformTravelToFormData`;
upsert-ответ → `applySavedData`), поэтому полный deep-equal всей `TravelFormData`
**запрещён** — он ловит серверный шум и даёт ложный диалог при простом открытии статьи
(инцидент 2026-07: «только открыла — уже предлагает черновик»).

Сравниваются ТОЛЬКО смысловые пользовательские поля, в канонической форме:

- Текст: `name, description, plus, minus, recommendation, youtube_link, budget, year,
  number_peoples, number_days, visitedDate` — `String().trim()`, пустое и
  `__draft_placeholder__*` → отсутствует; число ≡ строке (`2024 ≡ '2024'`).
- Id-списки: `categories, transports, complexity, companions, over_nights_stay, month,
  countries, cities` — к строкам, отсортированы (порядок мультиселекта не смысл).
- Точки `coordsMeTravel`: `lat/lng` (число, округление 1e-6), `address`, `categories`.
  **Без `id`** (меняется при rehydrate) и **без `image`** (blob-превью не переживает
  reload; фото точки едет отдельным upload-пайплайном).
- Галерея: `id`, иначе URL без origin; `blob:`/`data:` игнорируются; отсортировано.
- Обложка `travel_image_thumb_url`: URL без origin; `blob:`/`data:` → отсутствует.
- `visa` (bool). **Игнорируются**: `id, slug, updated_at, publish, moderation`,
  счётчики и любые эхо-поля сервера — черновик не переносит серверные статусы.

Менять список полей — только синхронно с тестами
`__tests__/hooks/useDraftRecovery.test.ts` (кейсы «phantom draft / real edit») и с
оглядкой на контракт модерации #555.

## Верификация

- Jest: `npx jest __tests__/hooks/useDraftRecovery.test.ts`.
- Playwright: `e2e/draft-recovery.spec.ts` (сид заведомо смыслово-отличного черновика →
  диалог обязан появиться; после автосейва — не реанимироваться).
- Известная грабля e2e: оверлей диалога перехватывает клики под нагрузкой —
  `addLocatorHandler`, не полагаться на `aria-expanded`.
