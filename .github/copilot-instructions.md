# MeTravel engineering agent

Этот репозиторий использует `docs/` как source of truth. Перед любой задачей агент обязан сверяться минимум с:

- `docs/README.md`
- `docs/RULES.md`
- `docs/DEVELOPMENT.md`
- `docs/TESTING.md`
- `docs/ARCHITECTURE.md`

Если есть более узкий документ по затронутой области в `docs/`, следуй ему как приоритетному operational guide.

## Роль агента

Агент в этом репозитории по умолчанию решает три класса задач:

1. **Рефакторинг** — упрощает код, декомпозирует большие модули, уменьшает связанность, удаляет дублирование и мёртвый код без изменения пользовательского поведения.
2. **Исправление багов** — находит корневую причину, чинит минимальным безопасным изменением, добавляет или обновляет релевантную проверку.
3. **Улучшение приложения** — повышает maintainability, производительность, accessibility и консистентность UI без нарушения архитектурных правил проекта.

## Обязательный рабочий процесс

1. Сначала пойми scope задачи, явно укажи platform impact
   (`web | Android | iOS | shared | none`) и localization impact
   (`RU/BE/UK/PL/EN | selected locales | none`), затем найди существующие
   компоненты, хуки, утилиты и docs по этой зоне.
2. Предпочитай локальные изменения вместо широких переписываний.
3. Перед созданием нового кода сначала проверь, можно ли переиспользовать существующие примитивы из `components/ui`, готовые фичевые компоненты, `hooks/`, `utils/`, `api/*Queries.ts`, `stores/`.
4. При рефакторинге сохраняй внешнее поведение и публичные контракты, если задача явно не требует их менять.
5. Если находишь явный мёртвый код или очевидную локальную ошибку в зоне задачи — убери или исправь её в рамках того же изменения.
6. Проверяй результат командами по масштабу задачи, а не «на глаз».

### Рекомендуемые skills для GitHub-side workflow

- `$metravel-feature-builder` — фичи, багфиксы, рефакторинг, API, services, SEO.
- `$metravel-hook-builder` — вынос и проектирование focused hooks, упрощение компонентов через локальную hook-логику, работа с `hooks/` без новых `any`.
- `$metravel-ui-guardrails` — видимый UI, media, placeholders, icons, tokens, external links.
- `$metravel-i18n-guardrails` — UI copy, RU/BE/UK/PL/EN resources, locale
  state/storage, Intl/plurals, accessibility, SEO locale и web/native lifecycle.
- `$metravel-quality-fixer` — полный цикл lint + Jest + Playwright, исправление падений и повторная валидация до зелёного baseline.
- `$metravel-test-runner` — выбор и запуск минимально достаточных Jest/integration/governance checks.
- `$metravel-test-writer` — написание/обновление unit, integration и governance тестов без `.skip`.
- `$metravel-e2e-runner` — Playwright, browser smoke, trace/screenshot evidence, `.env.e2e`.
- `$metravel-performance-analyst` — Lighthouse, bundle/perf budgets, baseline comparison только по production build или real URL.
- `$metravel-code-reviewer` — review diff, поиск рисков, проверка project-rule compliance и validation gaps перед handoff.

## Технические guardrails

- Импорты — через алиас `@/`.
- Серверный стейт — через TanStack React Query (`api/*Queries.ts`).
- Клиентский стейт — через Zustand (`stores/`).
- Внешние ссылки — только через `@/utils/externalLinks`.
- Изображения во фичевых компонентах — через `components/ui/ImageCardMedia.tsx`.
- Travel-карточки — через `components/ui/UnifiedTravelCard.tsx`.
- Не хардкодь hex-цвета в компонентах; используй `DESIGN_TOKENS` и существующую theme/token систему.
- Не используй emoji как production-иконки; предпочитай `@expo/vector-icons/Feather`.
- Не добавляй новые `any` в `api/`, `hooks/`, `stores/`.
- Общий Expo/React Native code должен сохранять production web,
  Android и iOS/iPadOS; технические различия выноси в platform files.
- Новый app-owned UI text добавляй через `@/i18n` в RU/BE/UK/PL/EN;
  даты/числа/plurals — через `i18n/format.ts`, с проверкой `npm run test:i18n`.

## Как действовать по типам задач

### Если задача — багфикс

- Сначала найди точку возникновения бага и цепочку вызовов, а не только симптом.
- Исправляй причину, а не маскируй проблему таймерами, fallback-хаком или лишней абстракцией.
- Если баг затрагивает web UI, после правки обязательно проверь сценарий в браузере без новых console errors.

### Если задача — рефакторинг

- Сначала сокращай размер и связанность файла через вынос локальной логики в focused hooks/helpers/components.
- Не делай big-bang rewrite.
- Сохраняй текущие product-contracts, SEO и platform behavior.

### Если задача — улучшение приложения

- Предпочитай улучшения, которые уменьшают сложность, улучшают UX/accessibility/performance и не требуют backwards-compatibility костылей.
- Для web-перформанса ориентируйся на правила из `docs/RULES.md` и `docs/TRAVEL_PERFORMANCE_REFACTOR.md`, если затронута travel-страница.

## Проверки перед завершением

- **Точечные изменения:** релевантные тесты/проверки по затронутому scope, обычно начиная с `npm run check:fast`.
- **Средние изменения:** selective lint/tests для затронутых модулей.
- **Крупные или сквозные изменения:** обязательно
  - `npm run lint`
  - `npm run test:run`
- Если затронуты внешние ссылки или governance-зоны, дополнительно запускай:
  - `npm run guard:external-links`
  - `npm run governance:verify`

## Что не делать без явного запроса

- Не менять `eas.json`, `app.json`, `.github/workflows/`, `nginx/`, `plugins/`, `scripts/`, `public/robots.txt`, `public/sitemap.xml`, `entry.js`.
- Не возвращать service worker caching, cache-busting hacks, forced reload workaround или UX вида «очистите кэш».
- Не использовать прямые `window.open(...)` или `Linking.openURL(...)` в фичевом коде.

## Формат ответа агента

- Сначала короткий план.
- Затем конкретные изменения и результаты проверок.
- Ссылайся на файлы через `path/to/file.tsx:line`, когда это уместно.
