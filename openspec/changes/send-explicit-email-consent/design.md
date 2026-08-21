## Context

См. `proposal.md` и `specs/email-subscription-consent/spec.md`. Сейчас общий компонент формы проверяет обязательный checkbox, но вызывает API adapter без consent-полей. Отдельная action-consent запись использует default version `1`, поэтому subscription payload и запись авторизованного пользователя не связаны с конкретной формулировкой.

Затронутый frontend ownership: `components/common/EmailSubscriptionForm.tsx`, `api/misc.ts`, `utils/actionConsent.ts` и ближайшие Jest/i18n tests. Backend #1502 — read-only dependency; `../metravel-backend` не редактируется.

## Goals / Non-Goals

**Goals:**

- Один источник type/version/label-key для email-согласия.
- Один optional adapter contract, который невозможно превратить в `consent: false` в wire payload.
- Positive/negative tests на реальный JSON construction path и одинаковую версию action-consent записи.
- Сохранение web cookie/CSRF и native token split существующего public POST.

**Non-Goals:**

- Изменение checkbox, текста, ссылок, layout или success/error UI.
- Backend migration/API implementation, double opt-in, deploy или production rollout.
- Общий рефакторинг всех типов consent и изменение default version для соседних flows.

## Decisions

### 1. Централизовать email-consent descriptor в существующем consent module

Descriptor хранит `type`, стабильный читаемый `version` и typed i18n `labelKey` как один immutable объект. Компонент использует descriptor и для показанного label, и для `useActionConsent`, и для subscription payload.

Отвергнуто: оставить строку `'1'` на default-параметрах. Она не идентифицирует формулировку и позволяет двум путям незаметно разойтись. Отвергнуто также вычисление версии в runtime из перевода: оно создаёт разные opaque ids по локалям и усложняет аудит; одна версия должна представлять согласованный пакет переводов.

Regression control связывает version-id с точным набором RU/BE/UK/PL/EN текстов. При изменении любой формулировки тест заставляет явно пересмотреть descriptor/version.

### 2. Передавать optional consent как объект явного утверждения

API adapter получает optional shape `{ granted: true, version: string }`. Wire fields добавляются только при runtime-условии `granted === true` и непустой trimmed version. При missing/false/blank shape оба поля опускаются; `consent: false` не сериализуется.

Отвергнуто: два независимых optional-параметра `consent?: boolean` и `consentVersion?: string`, потому что они допускают противоречивые комбинации. Отвергнута и безусловная генерация `consent: true` внутри adapter: adapter не знает, было ли явное пользовательское действие.

### 3. Не менять response/error/auth behavior

Новые поля добавляются только в JSON body существующего `POST /api/subscribe/`. Existing request initialization, sanitization, CSRF/native auth split, timeouts, `created`/`exists` mapping и error localization остаются без изменений.

### 4. Validation matrix

| Поверхность | Обязательное доказательство |
| --- | --- |
| Shared adapter/component | Targeted Jest: checked payload, unchecked/false/blank omission, same version in action consent, `created`/`exists` |
| Desktop web / mobile web | Source contract + tests; видимый UI не меняется, поэтому отдельные screenshots не требуются |
| Android / iPhone | Source contract + shared tests; platform-specific behavior/config/runtime не меняются, device gate не требуется |
| RU/BE/UK/PL/EN | `npm run test:i18n` и regression test точного wording bundle/version |
| Integrated target API | После отдельного backend deploy/frontend rollout: guest row получает email-linked version/timestamp; authenticated `email_subscribe` не возвращает 400 |

## Risks / Trade-offs

- **[Версия забыта при правке перевода]** → exact wording-bundle regression test и комментарий у descriptor требуют совместного обновления.
- **[Frontend выкатили раньше backend optional fields]** → production rollout только после target API evidence; mock-only fallback запрещён.
- **[Malformed caller обходит TypeScript]** → runtime predicate опускает оба consent-поля для false/blank input.
- **[Два серверных consent request для signed-in пользователя]** → это согласованный backend #1502 contract: subscribe хранит email-linked evidence, action-consent хранит user-linked evidence; оба используют одну версию и остаются non-blocking относительно UX.

## Migration Plan

1. Добавить descriptor и optional adapter shape без изменения существующих callers.
2. Перевести email form на descriptor и explicit consent option.
3. Прогнать targeted Jest, `npm run test:i18n`, `npm run check:fast` и review-and-fix.
4. После отдельного разрешения и готовности backend выполнить frontend rollout и integrated probes из #1522/#1502.

Rollback: удалить передачу optional consent option из формы и adapter payload, оставив существующий email subscription contract. Это возвращает прежнее отсутствие server evidence, но не ломает подписку и не требует data migration.
