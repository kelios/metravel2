# CLAUDE.md — MeTravel

Кросс-платформенное туристическое приложение (iOS/Android/Web). Это репо — только фронтенд. Бэкенд — отдельный сервис (см. раздел «Бэкенд»).

## Стек
React 19 + React Native 0.84 + Expo 55 (Expo Router, file-based) · web: RN Web + Metro · TanStack Query 5 (серверный стейт, `api/*/Queries.ts`) · Zustand 5 (`stores/`) · карты: Leaflet (web) / RN Maps (native) · Reanimated 4 · yup · TypeScript 5.7 strict · Jest 29 + Playwright 1.49 · ESLint 9 + Prettier 3 (no semicolons, single quotes) · yarn 1.22 · EAS Build.

## Структура
`app/` экраны (Expo Router, `(tabs)/` — табы) · `components/` по фиче (`ui/`, `common/`, `layout/`, `article/`, `travel/`, `map/`) · `hooks/` · `utils/` · `api/` · `stores/` · `context/` · `constants/` · `types/` · `config/` · `scripts/` · `docs/` · `__tests__/` · `e2e/` · `public/` (robots, sitemap).

## Команды
- dev: `npm start` | `npm run web` | кэш: `npm run clean` / `reset`
- build: `npm run build:web` (→ `dist/prod/`), `build:web:prod` (с SEO-страницами), `ios:build:prod` / `android:build:prod` (EAS)
- тесты: `npm run test:run` (Jest, один прогон), `test:coverage`, `e2e` (Playwright), `test:smoke:critical`
- качество: `npm run lint`, `typecheck`, `format`, `guard:external-links`, `check:image-architecture`, `guard:file-complexity`
- релиз: `npm run release:check`

## Правила кода
- Изображения в фичевых компонентах — только через `components/ui/ImageCardMedia.tsx` (прямой импорт `expo-image` запрещён ESLint-гвардом)
- Travel-карточки — только через `components/ui/UnifiedTravelCard.tsx`
- Внешние ссылки — только `@/utils/externalLinks.openExternalUrl`, не `Linking.openURL` (гвард)
- Серверный стейт — React Query, клиентский — Zustand; импорты через алиас `@/`
- TS strict; новый `any` запрещён в `api/`, `hooks/`, `stores/`; RN Web-совместимость для всех компонентов, используемых на web
- НЕ добавлять: комментарии/docstrings к нетронутому коду, error handling невозможных сценариев, абстракции для одноразовых операций, backwards-compat костыли

## Не трогать без явного запроса
`eas.json`, `app.json`, `.github/workflows/`, `nginx/`, `plugins/`, `scripts/`, `public/robots.txt`, `public/sitemap.xml`, `entry.js`

## Бэкенд
**НЕ правим — только заводим задачи.** Репо `../metravel-backend` (D:\metravel\metravel-backend), владелец — Sergey/Codex. Читаем и диагностируем, но НИКОГДА не редактируем его код (.py, тесты, миграции, конфиги, деплой). Нужная правка бэка = TASK-файл `tasks/NNN-*.md` (шаблон `tasks/000-template.md`, Owner: Backend) + строка в `docs/BACKEND_WORKBOARD.md`. Случайно изменил файл бэка — откати (`git checkout -- <file>`) и переоформи задачей. Диагност — агент `backend-expert` (read-only по бэку).

## Окружение
- API: `EXPO_PUBLIC_API_URL` (прод `https://metravel.by`), авторизация `Authorization: Token <token>`
- Env-файлы: `.env`, `.env.dev`, `.env.prod`, `.env.e2e`, `.env.preprod`; локальный API: `EXPO_PUBLIC_IS_LOCAL_API=true`; routing-карты: `EXPO_PUBLIC_ORS_API_KEY`
- Авторизованный QA: e2e-аккаунт из `.env.e2e` (`E2E_EMAIL`/`E2E_PASSWORD`) через программный логин (login API → Token) или Playwright auth setup; без ручного ввода пароля, без секретов в логах/скринах; только локально/preview, без деструктива
- Всегда верифицировать самому (браузер/тесты) до сдачи — не отмечать «готово», пока проверка не прошла. Нестабильный dev-сервер — перезапускать и повторять; если проверить реально невозможно из-за внешнего блокера — явно `verify pending` с причиной

## Секреты
Никогда не просить пользователя вставлять секреты в чат. Вместо этого: указать путь к gitignored-файлу (`.secrets/<имя>.json`) или env-переменную — пользователь кладёт сам; перед использованием проверить `git check-ignore <path>`; код читает ключ из файла/env, не хардкодит; секрет, показанный в чате/закоммиченный = утёк → явно сказать и поставить задачу на ротацию; не логировать секреты. Текущие ключи: Google → `.secrets/gcp-service-account.json`, OAuth → `.secrets/google-oauth-*.json` (`npm run stats:gsc` / `stats:ga4`).

## Архитектурные правила (web-перформанс)
1. **iOS Safari + `ImageCardMedia`** (contain + `allowCriticalWebBlur`): НЕ показывать главное изображение до завершения декода — WebKit рисует «размытый прогрессивный кадр», если открыть `<img>` до `onLoad`. `priority="high"` задаёт только `fetchPriority`, reveal всё равно ждёт декод (`shouldShowWebImageImmediately` в `ImageCardMedia.tsx`). Featured- и popular-карточки одинаковы по моменту показа sharp-кадра.
2. **`backdrop-filter: blur()` на fixed/sticky барах**: блюр не отключать (часть дизайна), но живой backdrop-filter поверх скролла убивает мобильный GPU. На мобильном — статичный «фрост» `colors.surfaceMuted` (`rgba(255,255,255,0.75)` / dark `rgba(42,42,42,0.75)`); живой блюр — только на десктопных элементах. Применено: `components/layout/BottomDock.tsx`, `components/travel/details/TravelStickyActions.tsx`.

## Git
Только ветка `main`, без новых веток и без worktrees. Коммитить из основного каталога репозитория.

## Skills
Карта skills и сценариев — `docs/CODEX.md`. `$metravel-hook-builder` — вынос/упрощение focused hooks; `$metravel-quality-fixer` — полный прогон lint/Jest/Playwright до зелёного; `$metravel-code-reviewer` — review diff перед handoff.

## Стиль ответов
Короткий план (2–5 пунктов) → изменения кода; без пересказа условия и trailing summary; ссылки `path/to/file.tsx:line`. Экономить контекст: поиск и массовое чтение файлов делегировать субагентам (Explore), не читать большие файлы целиком без необходимости.
