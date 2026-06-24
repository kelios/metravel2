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
- **Фото — доминанта карточки:** в любой полноразмерной карточке с изображением (travel/место/статья/hero) фото — главный элемент и должно занимать ~70% высоты карточки; фото не перекрывать значимо (оверлеи ♥/＋/развернуть/закрыть/бейджи/scrim — только в углах или узкой зоной, не затемнять кадр). Увеличивать именно высоту/пропорцию фото-блока, НЕ менять `contain`+blur на `cover`. Исключения — компактные mini/utility/list-итемы (напр. `QuestForCityCard`, `SelectedTravelOrderCard`), где фото намеренно второстепенно
- **Шапка ≤20% экрана на мобильном (правило для всех агентов):** на мобильном (web + native, `isMobile`) фиксированная/закреплённая шапка любого экрана (тулбар действий, степпер, заголовок, табы фильтров) не должна занимать больше ~20% высоты вьюпорта — контент должен быть виден сразу, без скролла. Не складывать тулбар-кнопки в вертикальный столбец на узком экране (длинные подписи переносятся в несколько строк) — на мобильном делать их icon-only в один ряд (подпись — в `accessibilityLabel`), убирать дублирующий заголовок, ужимать вертикальные паддинги. Полные текстовые кнопки/подписи — только desktop. Применено: `components/quests/questWizardShell.tsx` (`QuestHeaderPanel`, `actionIconButton`)
- Внешние ссылки — только `@/utils/externalLinks.openExternalUrl`, не `Linking.openURL` (гвард)
- Серверный стейт — React Query, клиентский — Zustand; импорты через алиас `@/`
- TS strict; новый `any` запрещён в `api/`, `hooks/`, `stores/`; RN Web-совместимость для всех компонентов, используемых на web
- НЕ добавлять: комментарии/docstrings к нетронутому коду, error handling невозможных сценариев, абстракции для одноразовых операций, backwards-compat костыли
- **Сохранение travel = save ≠ moderate (load-bearing, см. `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md`):** автосейв/content-save НИКОГДА не блокируется валидацией полноты и не теряет данные при любом статусе. Валидация полноты (categories у точек, обязательные поля) — РОВНО ОДИН РАЗ, при явной отправке ещё‑не‑промодерированной статьи на модерацию (`enforce_moderation_validation=true` И текущий `moderation=false`). Уже промодерированную (`moderation=true`) статью правим как черновик — без валидации, доверяем автору. Любой агент, трогающий редактирование/создание travel, сверяется с этим контрактом (тикет #555)

## Не трогать без явного запроса
`eas.json`, `app.json`, `.github/workflows/`, `nginx/`, `plugins/`, `scripts/`, `public/robots.txt`, `public/sitemap.xml`, `entry.js`

## Бэкенд
**НЕ правим — только заводим задачи.** Репо `../metravel-backend` (D:\metravel\metravel-backend), владелец — Sergey/Codex. Читаем и диагностируем, но НИКОГДА не редактируем его код (.py, тесты, миграции, конфиги, деплой). Нужная правка бэка = тикет на общем MCP task board (`area=back`, через агент `ticket-board`; борд = единый источник правды, см. `docs/TASK_BOARD_MCP.md`). Случайно изменил файл бэка — откати (`git checkout -- <file>`) и переоформи тикетом. Диагност — агент `backend-expert` (read-only по бэку); статусы/доказательства закрытия сверяет `backend-status-sync` (пишет верификацию в комментарии тикетов борда).

**FE-guard rule (load-bearing):** фронтовый костыль-митигейшн под бэкенд-баг (напр. `useAvatarUri` кэширует упавшие avatar-URL, `utils/secureStorage.ts` XOR-хранилище токена, `registerPushTokenApi` глотает ошибки) остаётся нагруженным, пока бэк-фикс не **верифицирован** (код на `origin/master` + наблюдаемое поведение на проде) И не покрыт **FE-regression-тестом** на новое поведение. До этого guard не удалять — максимум помечать `defensive-only`. Привязку «какой guard под каким тикетом» хранить в самом тикете борда.

## Окружение
- API: `EXPO_PUBLIC_API_URL` (прод `https://metravel.by`), авторизация `Authorization: Token <token>`
- Env-файлы: `.env`, `.env.dev`, `.env.prod`, `.env.e2e`, `.env.preprod`; локальный API: `EXPO_PUBLIC_IS_LOCAL_API=true`; routing-карты: `EXPO_PUBLIC_ORS_API_KEY`
- Авторизованный QA: e2e-аккаунт из `.env.e2e` (`E2E_EMAIL`/`E2E_PASSWORD`) через программный логин (login API → Token) или Playwright auth setup; без ручного ввода пароля, без секретов в логах/скринах; только локально/preview, без деструктива
- Всегда верифицировать самому (браузер/тесты) до сдачи — не отмечать «готово», пока проверка не прошла. **Никогда не перекладывать браузер-проверку на пользователя:** просьба «пролистай / нажми hard-refresh / открой консоль / вставь сниппет / скажи что видишь / пришли скрин» — это НЕ верификация, а оффлоадинг, и он запрещён как замена собственной проверки. Баг от пользователя — это вход; подтвердить фикс в браузере — твоя работа. Нестабильный dev-сервер — перезапускать и повторять. Если дефолтное превью не открывает/не раскладывает цель (headless `innerHeight=0`, RN-Web скроллит внутренний контейнер → `window.scrollTo`/IntersectionObserver не стреляют, прод-only роут, dev-SSR крашит страницу) — ОБЯЗАН исчерпать альтернативный путь до объявления блокера: локальная prod-сборка + статик с прод-API (`Prod Static`/`Dist Prod`), Playwright/e2e, или device-verify на реальной сборке. `verify pending` — только когда реально перепробованы все доступные пути (перечислить какие)

## Секреты
Никогда не просить пользователя вставлять секреты в чат. Вместо этого: указать путь к gitignored-файлу (`.secrets/<имя>.json`) или env-переменную — пользователь кладёт сам; перед использованием проверить `git check-ignore <path>`; код читает ключ из файла/env, не хардкодит; секрет, показанный в чате/закоммиченный = утёк → явно сказать и поставить задачу на ротацию; не логировать секреты. Текущие ключи: Google → `.secrets/gcp-service-account.json`, OAuth → `.secrets/google-oauth-*.json` (`npm run stats:gsc` / `stats:ga4`).

## Архитектурные правила (web-перформанс)
1. **iOS Safari + `ImageCardMedia`** (contain + `allowCriticalWebBlur`): НЕ показывать главное изображение до завершения декода — WebKit рисует «размытый прогрессивный кадр», если открыть `<img>` до `onLoad`. `priority="high"` задаёт только `fetchPriority`, reveal всё равно ждёт декод (`shouldShowWebImageImmediately` в `ImageCardMedia.tsx`). Featured- и popular-карточки одинаковы по моменту показа sharp-кадра.
2. **`backdrop-filter: blur()` на fixed/sticky барах**: блюр не отключать (часть дизайна), но живой backdrop-filter поверх скролла убивает мобильный GPU. На мобильном — статичный «фрост» `colors.surfaceMuted` (`rgba(255,255,255,0.75)` / dark `rgba(42,42,42,0.75)`); живой блюр — только на десктопных элементах. Применено: `components/layout/BottomDock.tsx`, `components/travel/details/TravelStickyActions.tsx`.

## Git
Только ветка `main`, без новых веток и без worktrees. Коммитить из основного каталога репозитория.

## Skills
Карта skills и сценариев — `docs/CODEX.md`. `$metravel-hook-builder` — вынос/упрощение focused hooks; `$metravel-quality-fixer` — полный прогон lint/Jest/Playwright до зелёного; `$metravel-code-reviewer` — review diff перед handoff.

## Android / native
Выпуск Android-приложения через EAS (облако, Windows-friendly; package `by.metravel.app`). Агенты: `android-expert` (нативный FE-код — Platform-ветвление, карта/expo-модули/push/secure-store, разбор крашей), `android-builder` (EAS-сборка `android:build:*` + submit в Google Play; `app.json`/`eas.json`/`scripts/` не правит без явного запроса). Скиллы: `android-release` (пошаговый регламент выпуска), `android-native-audit` (web-API без Platform-guard и web-only импорты в native-бандле).
**Кодекс native-совместимости — `docs/NATIVE_COMPAT_RULES.md`** (10 правил из реальных крашей: babel-трансформы по платформе, blessed-версии expo-модулей, `Promise.resolve(import())`, web-роли a11y под гейтом, postinstall-патчи как первый подозреваемый, отладка dev-client+adb вместо новых сборок + device-verify с явным Reload, `expo-file-system` только через `/legacy` (главный экспорт throw-ит), без хеш-якорей `#id` в `router.push` на native, native-карта = прод-origin тайлов). Автостраж: `__tests__/config/native-compat-governance.test.ts`.

## Стиль ответов
Короткий план (2–5 пунктов) → изменения кода; без пересказа условия и trailing summary; ссылки `path/to/file.tsx:line`. Экономить контекст: поиск и массовое чтение файлов делегировать субагентам (Explore), не читать большие файлы целиком без необходимости.
