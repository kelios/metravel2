## Context

См. proposal.md и Task Contract #2693. Аналитик и travel-expert до кода подтвердили цепочку: `useTravelPublishModeration.ts:78–95` выводит состояние по флагам, `TravelWizardStepPublish.tsx:211` скрывает панель, `useTravelFormPersistence.ts:383–424` отбрасывает canonical по allowlist, `api/misc.ts:270–273` отправляет конфликтующие флаги. `travelFormNormalization.ts:202` самостоятельно определяет draft; persistence отключает autosave для approved/published. Имеющиеся списковые helpers имеют самостоятельных consumers и должны сохранить публичный API.

## Goals / Non-Goals

Goals: единый адаптер чтения/записи для мастера, сохранность состояния на full/content/route-save, явные команды и защита очереди от старого статуса.

Non-Goals: новый layout, backend, изменение ролей, показ moderation_decision, переделка списков и побочные refactor.

## Decisions

1. Расширить `utils/travelPublicationStatus.ts`: тип четырёх состояний, resolver canonical, require-known для write, explicit command union и общий full-payload builder. Типы/пустая форма/hydration сохраняют canonical. Canonical null/empty/unknown хранится до исправления на сервере и вызывает локализованную ошибку, а не потерю формы. Legacy fallback только при absent/undefined: FF=draft, TF=pending_review, FT=approved, TT=published. Альтернатива подмены флагов pending→TF отвергнута: она сохраняет второй источник истины.
2. PUT save: `publication_status:S`, `enforce_moderation_validation:false`; submit: pending_review/true; approve: published/false; reject: draft/false плюс trim(reason) 1–2000. Во всех случаях исключить legacy и replay причины из GET. Content PATCH содержит только изменённые текстовые поля; require-known до выбора пути. Backend read-only; server roles сохраняются.
3. В persistence сериализовать команды и обычные сохранения, отменять pending autosave при команде и использовать подтверждённый статус для queued saves. После успешного ответа обновлять canonical baseline. Ошибка не меняет confirmed state и не удаляет новые правки/причину.
4. В UI отделить текущее состояние от следующей команды. Pending сразу открывает доступные модератору действия, approved имеет собственный чип. Существующие summary/checklist/admin panel/ConfirmDialog и порядок действий остаются. Unknown виден, опасные действия disabled. Переиспользовать locale keys; новые ключи во всех RU/BE/UK/PL/EN.
5. Canonical проходит normalization, draft placeholders и завершение wizard/controller. Запретить самостоятельный вывод статуса по флагам в этих путях постоянным governance-тестом; настоящий mapper→persistence→serializer покрывается behavioral tests.

Task-owned additions к proposal: `utils/travelFormNormalization.ts`, `hooks/useTravelWizard.ts`, `components/travel/upsert/useUpsertTravelController.ts`, locale resources и связанные regression tests. Документировать новый контракт и permanent control в Problem Memory. Design evidence: `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md`, состояния draft/pending/approved/published/unknown, author/admin, loading/error/retry, обе ширины.

## Risks / Trade-offs

- [Старые draft/fixtures без canonical] → документированный fallback, реальные adapter tests и сохранение list helper API.
- [Старый autosave после команды] → единая очередь и подтверждённый baseline, regression на гонку.
- [Ошибка PUT/PATCH] → confirmed state только после успеха, сохранение текста и rejection reason для retry.
- [Неподдерживаемый статус] → fail-closed write с видимой ошибкой; форму не терять.
- [Дополнительные autosave для approved/published] → существующий debounce/content delta, без новых движков/запросов без изменений.

## Validation matrix

До testing: настоящий GET→mapper→form→serializer для 4 статусов; manual/full/route/PATCH; команды и отсутствие replay; fallback/invalid; очереди и failure. Targeted Jest из #2693 плюс normalization/persistence tests и governance; lint/tsc, `npm run test:i18n`, полный lint/test baseline по масштабу. Затем независимые review-auditor и code-review-gate.

В testing после commit/push/deploy: prod `.build-source.json`, author/admin 1440/390, собственные тестовые статьи draft/pending/approved/published; PUT/PATCH и повторный GET после save/autosave/route; явные submit/approve/reject, отрицательные причины/ошибка. Скриншоты и console; удалить созданные сущности. Подготовка local backend по §3.0 WORKFLOW_OPERATIONS до первой runtime-пробы. Android/iOS device gate не применим: platform-specific runtime не меняется.

SEO/analytics неприменимы: URL/метаданные/события не меняются. Accessibility: сохранить focus/semantics/keyboard/touch. Performance: без новых dependencies, fan-out и media changes. Security: серверные роли, текущая санитизация и секреты вне логов.

## Migration Plan

Без миграции данных. Один task diff проходит review, explicit-path commit/push main, штатный production deploy и приёмку по #2693. При регрессии откатить единый task commit и выкатить предыдущий рабочий SHA штатным скриптом; контент и серверная схема не меняются. OpenSpec архивировать только после зелёного Done gate.
