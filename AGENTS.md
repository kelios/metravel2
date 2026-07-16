# AGENTS.md

Инструкции для AI-агента в проекте `metravel`.

## 0. Обязательность инструкций

- Применяй эти правила во всех задачах в этом репозитории.
- При конфликте между "быстро сделать" и правилами проекта приоритет у правил.
- Перед началом и перед завершением задачи сверяйся с этим файлом как с чеклистом.

## 1. Контекст и границы

- Рабочая директория приложения: корень репозитория, папка с `package.json`.
- Источник правил проекта: `docs/RULES.md` и `docs/README.md`.
- Карта работы Codex и skills: `docs/CODEX.md`.
- Активные продуктовые поверхности — desktop web, mobile web и Android.
  iOS/iPadOS-приложения пока нет: iOS не входит в обязательную validation,
  Done gate или `verify pending`, даже если в репозитории остаются `.ios.*` и
  `ios/` как технический задел. Перед любой задачей явно определи platform
  impact: `desktop web | mobile web | Android | shared | none`; правка
  shared-кода не должна ломать непроверенные активные поверхности.
- Production UI многоязычен: RU/BE/UK/PL/EN, default/fallback — RU.
  Источник locale contract — `i18n/config.ts`, resource contract —
  `i18n/resources.ts`. Перед любой задачей явно определи localization
  impact: `all current locales | selected locales | none`.
- Работай только с веткой `main`: перед изменениями проверь текущую ветку, не создавай и не переключайся на другие ветки без явной новой инструкции пользователя.
- В этом workspace AI-агент делает только frontend/app/docs изменения. Backend/Django/API/server (`../metravel-backend`, `area=back`) можно только анализировать read-only, проверять безопасными probes и оформлять/обновлять задачи на борде; backend working tree, миграции, тесты, настройки и server code не редактировать. Запрещены любые изменяющие backend Git-операции локально и на сервере: `add`, `commit`, `push`, `pull`, `merge`, `rebase`, `tag`, `checkout`, `reset`, `restore`, `stash`, `clean`.
- На production-сервере Git-tracked файлы backend checkout неизменяемы для AI-агента. Перед любой явно разрешённой server-write операцией сначала read-only проверь `git status --short` и каждый repo-relative путь через `git ls-files --error-unmatch -- <repo-relative-path>`; tracked path нельзя патчить, перезаписывать, копировать, удалять, переименовывать или менять ему права. Если checkout уже dirty, ничего не исправляй и не продолжай deploy/pull: зафиксируй paths/diff summary без секретов, создай/обнови `area=back`/ops задачу и передай backend-владельцу. Разрешённые project-owned frontend deploy scripts могут менять только документированные untracked runtime/static targets вроде `static/dist`.
- Если frontend-задача требует ещё не существующего backend-контракта или исправления на сервере и поэтому реализацию нельзя начать/продолжить, не маскируй это mock-фолбэком: создай/обнови `area=back` задачу и используй `blocked_by` с реальной hard dependency. Если frontend уже реализован и ждёт backend/deploy/production/API/browser/device validation, держи его в `review` или `testing`, а не в `blocked_by`.
- Колонка `blocked_by` означает только невозможность начать или продолжить работу из-за конкретной незакрытой внешней зависимости. Незавершённый Done gate, ожидание review/QA/production-проверки или неуспешная проверка сами по себе не являются блокировкой: готовый код идёт в `review`/`testing`, а найденный дефект возвращает задачу в `in_progress`.
- Не меняй разрешённые untracked production runtime/SSL-пути без явной проверки существования на сервере; Git-tracked конфиги на сервере не меняй вообще.
- Не меняй без явного запроса `eas.json`, `app.json`, `.github/workflows/`, `nginx/`, `plugins/`, `scripts/`, `public/robots.txt`, `public/sitemap.xml` и `entry.js`; если пользователь прямо просит изменить один из этих путей, это и есть необходимое разрешение в scope задачи.
- Не добавляй сложность без необходимости: сначала используй существующие компоненты, хуки и утилиты.

## 2. Skills для Codex

Перед работой выбери минимальный набор project skills:

- `$metravel-feature-builder` - фичи, рефакторинг, баги, API, hooks, services, SEO и обычная разработка.
- `$metravel-domain-router` - карта доменных feature areas (travel/map/profile/achievements/quests/PDF/new pages), файлов, owner-boundaries и нужных проверок перед разработкой.
- `$metravel-travel-expert` - доменный субагент travel: списки/детали/мастер, route points, save/moderation, export/PDF.
- `$metravel-map-expert` - доменный субагент карты и places: MapPage, Leaflet web, native map/WebView, ORS и попапы.
- `$metravel-profile-expert` - доменный субагент профиля: личный/публичный профиль, settings, подписки, счётчики, profile IA.
- `$metravel-achievements-expert` - доменный субагент achievements/badges: ранги, XP, peer-награды, моки и profile embeds.
- `$metravel-quest-expert` - доменный субагент quest-кода: список/деталь/прохождение, адаптеры, answer checker, печать.
- `$metravel-quest-writer` - автор нового городского квеста: research, связный пеший маршрут, intro/steps/finale, задания, hints и answer patterns; творческий текст только после отдельного подтверждения пользователя.
- `$metravel-quest-editor` - субагент редактирования контента существующих квестов: тексты, задания, подсказки, answer patterns.
- `$metravel-quest-geo-verifier` - read-only субагент гео-сверки точек квестов через OSM/Nominatim и локальные geocheck scripts.
- `$metravel-hook-builder` - проектирование, вынос и рефакторинг focused React hooks в `hooks/` и рядом с фичами без нарушения public contracts.
- `$metravel-ui-guardrails` - видимый UI, layout, media, placeholders, icons, design tokens, external links.
- `$metravel-i18n-guardrails` - многоязычный UI и locale-sensitive логика на web
  и Android: translation keys/resources, language persistence, Intl/plurals,
  accessibility, SEO locale и i18n validation.
- `$metravel-design-auditor` - read-only сквозной аудит нескольких экранов: design-system consistency, responsive/mobile parity, состояния, accessibility и evidence matrix.
- `$metravel-visual-asset-designer` - генерация и интеграция брендовых raster icons/badges/app/marketing assets через imagegen по `docs/ICON_ART_PROMPTS.md`; не подменяет Feather icons или фотореалистичные travel/article media.
- `$metravel-child-quest-visuals` - отдельный автор визуалов детских/семейных/подростковых квестов: возрастной режим, акварель/сказка/анимация, сюжетная читаемость обложки, imagegen, prompt и production verification.
- `$metravel-browser-reviewer` - browser review/fix loop для видимых web-изменений: diff + preview/browser + screenshot + console/network + reverify.
- `$metravel-refactor-surgeon` - распил god-components и file-complexity нарушений без изменения поведения.
- `$metravel-release-checks` - выбор и запуск проверок, preflight, release/deploy, production web checks.
- `$metravel-quality-fixer` - полный прогон lint + Jest + Playwright с исправлением найденных проблем и обязательным rerun проверок.
- `$metravel-test-runner` - точечный запуск Jest/unit/integration/governance проверок, выбор минимального набора команд и разбор падений.
- `$metravel-test-writer` - написание и обновление unit/integration/governance тестов без `.skip`, с опорой на реальные контракты фичи.
- `$metravel-e2e-runner` - запуск и отладка Playwright/e2e сценариев, browser smoke, работа с `.env.e2e`, trace и screenshot evidence.
- `$metravel-performance-analyst` - Lighthouse, bundle/perf budget analysis, сравнение baseline и проверка performance только по production build или real URL.
- `$metravel-growth-analyst` - анализ GA4/GSC/Yandex/affiliate-цифр, SEO/organic роста, поведения пользователей, воронок регистрации и добавления маршрутов/статей.
- `$metravel-seo-index-operator` - ежедневная SEO/index рутина, GSC/index diagnostics, IndexNow backup, список URL для ручной индексации и SEO task routing.
- `$metravel-code-reviewer` - focused code review diff'а, поиск рисков, rule violations, validation gaps и остаточных проблем перед handoff.
- `$metravel-security-reviewer` - evidence-backed frontend security review: XSS/sanitization, unsafe URLs/redirects, secrets/tokens, WebView/deep links и production dependencies; read-only без явного запроса на fixes.
- `$metravel-devops-agent` - подготовка, запуск и проверка deploy на dev/preprod/prod с preflight, secret hygiene и post-deploy validation.
- `$metravel-google-play-operator` - локальная Android production AAB-сборка и
  production-only Google Play API без EAS; closed-testing tracks и настройки
  защищены от изменений.
- `$metravel-production-smoke` - read-only smoke production `metravel.by` после deploy или при подозрении на 502/white screen/static/API/sitemap регрессию.
- `$metravel-docs-maintainer` - обновление `docs/`, `AGENTS.md`, `.codex/skills` и правил для Codex.
- `$metravel-prompt-maintainer` - аудит и поддержка `docs/*PROMPTS.md`, `assets/**/PROMPT.md`, skill metadata/default prompts, воспроизводимости и prompt-governance без написания самого article/quest content.
- `$metravel-task-contract` - обязательный контракт FE/BE задач на борде: scope, user-visible result, Data/API contract, platform/localization impact, dependencies, fallback/mock policy, validation и Done gate перед стартом/review/done.
- `$metravel-ticket-board` - оператор общего MCP task board: list/create/update/sync задач и спринтов без правки feature-кода.
- `$metravel-sprint-reviewer` - приёмка тикетов активного спринта на MCP task board по Task Contract/Done gate с реальными тестами/browser/API evidence.
- `$metravel-backend-diagnostician` - read-only диагностика backend/API проблем, 5xx/contract mismatch, backend status sync и создание/обновление back-задач с evidence.
- `$metravel-article-editor-agent` - создание/редактирование/публикация article и travel-guide записей через API, photo-folder drafts, generated images/media, author/publish verification и только подтвержденные текстовые правки без вывода токенов.
- `$metravel-codex-orchestrator` - верхний workflow для Codex: triage, выбор skills/агентов, промты ролей, план проверок и финальный self-check.
- `$metravel-agent-workflow` - координация ролей business analyst, system architect, designer, programmer, QA, reviewer и DevOps.
- `$metravel-project-analyst` - read-only анализ структуры проекта, активных фич, рисков, проверок и handoff к профильным агентам.
- `$metravel-android-developer` - Android/native разработка и отладка Expo/React Native без регресса production web.
- `$metravel-ios-developer` - неактивный future-iOS маршрут; используй только
  после нового явного решения пользователя вернуть iOS в scope, не для обычной QA.
- `$metravel-mobile-tester` - read-only парная проверка mobile web и Android,
  touch/layout/runtime баги и retest одного сценария на обеих поверхностях.
- `$metravel-play-campaign-tester` - ежедневный проход общей Google Play closed-testing кампании на настроенном USB Android, проверка заданий/обновлений/крашей и ведение общего campaign log без покупок, отзывов, удаления приложений или смены аккаунтов.
- `$metravel-business-analyst` - продуктовые требования, user stories, acceptance criteria, non-goals, metrics и risks.
- `$metravel-system-architect` - technical design, разбиение работ, validation plan и review diff на соответствие правилам.
- `$metravel-qa-agent` - read-only исследование приложения, воспроизведение багов, bug reports и re-test фиксов.

Если задача попадает сразу в несколько областей, используй skills вместе, но не загружай лишние справки.

## 3. Базовый рабочий процесс

1. Перед правками изучи релевантные файлы в `docs/`.
2. Быстро определи тип задачи, нужные skills, риск-зону, platform
   impact, localization impact и план проверки по `docs/CODEX.md`.
3. Для сложных, неясных или многошаговых задач используй `$metravel-codex-orchestrator` как верхний self-check: triage → skills → промты ролей → validation → handoff.
4. Проверь текущую ветку и `git status --short`; если ветка не `main`, остановись и уточни дальнейшие действия.
5. Внеси минимально достаточные изменения.
6. Временную отладочную информацию складывай только в ignored-папки (`.codex-temp/`, `.codex-debug/`) и перед завершением удаляй всё ненужное:
   - скриншоты, trace, временные JSON/лог-файлы и QA-вывод не должны попадать в tracked-папки;
   - оставляй только актуальные артефакты, которые нужны для текущей передачи результата.
7. Чини все реальные проблемы, найденные в ходе задачи:
   - исправляй ошибки из затронутого кода, проверок, браузерной валидации и сборки до передачи результата;
   - если проблема вне scope, требует доступа к серверу/секретам или рискованной миграции, явно зафиксируй блокер, риск и что нужно проверить дальше;
   - не оставляй известные падающие проверки, runtime-ошибки, broken UI states, direct external-link нарушения или dead code в зоне задачи.
8. После каждого логического шага запускай проверки по scope изменений:
   - точечные изменения: только релевантные тесты/чеки, которые покрывают затронутую область;
   - законченный малый блок кода: `npm run check:fast`;
   - средние изменения перед PR/передачей задачи: `npm run check:preflight`;
   - крупные изменения: полный прогон:
     - `npm run lint`
     - `npm run test:run`
9. По завершению задачи:
   - для точечных изменений обязательно запусти релевантные проверки по затронутому scope;
   - для крупных изменений обязательно запусти полный прогон.
10. Тестирование выполняет AI-агент самостоятельно: человек ничего не тестирует за агента.
    - Используй доступные средства проверки: браузер/Playwright, Android-устройство с локально установленной сборкой, unit/integration/e2e тесты, production web build/smoke по scope задачи.
    - Сам находи надежный маршрут проверки для конкретной задачи; просьба к пользователю проверить вручную не считается validation.

### 3.1 E2E окружение и доступы

- Для e2e-авторизации и тестовых доступов используй переменные из `.env.e2e`.
- Не запрашивай у пользователя повторно логин/пароль, если они уже заданы в `.env.e2e`.
- Никогда не выводи секреты из `.env.e2e` в ответах, логах, скриншотах и коммитах.
- Если task-board API/MCP отвечает `HTTP 401`, обнови staff token через программный login из `.env.e2e` по `docs/TASK_BOARD_MCP.md`, перезапиши `.secrets/metravel-task-board.env` без вывода токена и повтори `/api/tasks/`, `/api/tasks/board/`, `/api/sprints/`.

### 3.2 Android device testing and builds

- Android EAS/cloud builds and submits are disabled by project policy: do not run
  `eas build --platform android`, `eas submit --platform android` or any
  `--platform all` command. Android production artifacts are built locally by
  `npm run android:build:prod`; store operations use the project Google Play API
  script. Re-enabling Android EAS requires a new explicit user decision.
- Current standing release authorization permits the agent to prepare and run the
  local Android production build/Production submit when an Android release is the
  active task. This never authorizes changing `alpha`, `internal`, `beta`, tester
  lists, countries, or the active closed-testing release.
- Если задачу нужно проверить на Android, считай, что Android-телефон подключён к этому компьютеру по USB-кабелю: сначала проверь `adb devices -l`.
- Если `adb` показывает устройство со статусом `device`, сначала собери Android локально и установи сборку на телефон (`cd android && ./gradlew :app:installDebug` или `:app:assembleDebug` + `adb install -r ...`), затем самостоятельно тестируй нужный Android-сценарий по `docs/MANUAL_TEST_CASES.md` `AND-USB-*`.
- Не заменяй Android device validation mobile-web viewport, Expo web export, EAS preview/development/production build или dev-client/export flow без явного разрешения пользователя.
- `unauthorized`, отсутствие устройства или поломка локальной сборки/установки фиксируй конкретно: команда, результат и следующий безопасный шаг.

### 3.3 Active platform validation and mobile parity

- iOS/iPadOS-приложения пока нет. Не запускай iOS simulator/device/EAS QA, не
  добавляй iOS в обязательные проверки и не ставь `verify pending` из-за
  отсутствия iOS evidence. Вернуть iOS в validation можно только новым явным
  решением пользователя.
- Любое видимое UI/layout/interaction изменение проверяй на desktop web, mobile
  web и локально собранном Android-приложении на USB-устройстве.
- Mobile web и Android — связанная пара. Если задача затрагивает одну из этих
  поверхностей, автоматически включи вторую в scope и проверь один и тот же
  сценарий, состояние и locale на обеих.
- Mobile web и Android должны быть визуально и поведенчески идентичны по
  иерархии, порядку блоков, ключевым размерам, действиям и touch semantics.
  Допустимы только технические отличия движка, системных permissions/insets и
  OS API; они не должны создавать другой UX.

### 3.4 Координация долгих операций

- Деплой, release/build, production web build, Android local/EAS build or install, server rebuild/restart, full/preflight проверки, Playwright/e2e, Lighthouse и другие долгие операции с общими артефактами считаются эксклюзивными.
- Перед запуском такой операции проверь, не идет ли уже операция того же типа и target: активные процессы (`ps`/`pgrep -af` по `build-prod.sh`, `deploy-frontend.sh`, `npm run`, `playwright`, `lighthouse`, `expo export`, `eas build`, `eas submit`, `gradlew`, `expo run:android`, `adb install`, `docker compose`, `nginx`, `systemctl`) и lock-файлы вроде `dist/.prod-build.lock` или `.codex-temp/ops/*.lock`, если они есть.
- Если другой агент уже запустил deploy/build/rebuild для того же target, не запускай второй экземпляр: используй уже идущую операцию, дождись её только когда результат обязателен для твоего scope, либо зафиксируй blocker с PID, командой и target.
- Для test/quality gate действует отдельное non-waiting правило: если живой `.codex-temp/ops/quality-gate.lock` или активный quality-процесс уже существует, текущий чат сразу прекращает свой запуск. Не жди, не poll'и, не следи за завершением, не повторяй команду после освобождения lock и не запускай более узкий обходной тест.
- Если активный gate по своему scope покрывает проверки текущей задачи и автоматические тесты — единственный оставшийся Done-gate шаг, фиксируй `validation delegated: active gate pid/name` и задачу можно завершить/закрыть. Это не означает `passed`: владелец активного gate обязан исправить все реальные падения и повторить свою проверку; если падение нельзя исправить в его scope, он переоткрывает затронутую задачу или фиксирует blocker. Если scope активного gate не покрывает задачу либо остаются deploy/browser/API/device/другие проверки, фиксируй `validation skipped: active gate pid/name` и не закрывай задачу.
- Чат, который первым запустил gate, владеет его результатом и исправлениями. Остальные чаты не дублируют эту работу и не используют занятый gate как blocker, когда корректно применим `validation delegated`.
- Не убивай и не перезапускай чужой процесс без явной команды пользователя или документированного safe-wrapper'а. Если lock явно stale, сначала зафиксируй почему он stale, затем аккуратно очисти lock и продолжай.
- Если запускаешь новую долгую операцию без собственного lock механизма, оставь короткий marker в `.codex-temp/ops/` и удали его после завершения.
- `build-prod.sh` удерживает общий `.codex-temp/ops/web-build.lock` до конца полного цикла build + SEO + deploy. Не обходи этот wrapper: прямой `expo export` или запуск `scripts/build-web-safe.js` параллельно с deploy запрещен.
- Основные test/quality команды (`check:fast`, `check:changed`, `check:e2e:changed`, `check:preflight`, `test:run`, `e2e`, `release:check`) обязаны запускаться только через общий `scripts/run-with-quality-gate-lock.js`. Он использует атомарный `.codex-temp/ops/quality-gate.lock`, сообщает PID владельца и при живом владельце сразу возвращает нейтральный `SKIPPED` с кодом `0`, чтобы чат завершил собственный запуск без ожидания/ретрая. `SKIPPED` нельзя записывать как `passed`, но при выполнении условий выше он оформляется как `validation delegated` и не блокирует Done. Lock умершего процесса восстанавливается автоматически. Общая Jest-конфигурация применяет тот же контракт к прямому `npx jest`. Не обходи wrapper прямым Playwright-запуском.

## 4. Обязательные технические правила

### 4.1 External links

- Запрещено использовать `window.open(...)` напрямую в фичах.
- Запрещено использовать `Linking.openURL(...)` напрямую вне `utils/externalLinks.ts`.
- Используй только:
  - `openExternalUrl(...)`
  - `openExternalUrlInNewTab(...)`
  - `openWebWindow(...)` только для низкоуровневых инфраструктурных случаев.

Проверка:

- `npm run guard:external-links`
- `npm run governance:verify`

### 4.2 UI и компоненты

- Сначала переиспользуй `components/ui` и существующие фиче-компоненты.
- Для кнопок/иконок/чипов предпочитай существующие примитивы: `Button`, `IconButton`, `Chip`.
- Мобильная верстка должна быть визуально и поведенчески одинаковой на mobile web
  и Android. Платформенные файлы допустимы для технических зависимостей, но не
  для другого UX, порядка блоков, размеров ключевых зон или набора действий.
- Для map/place/travel-point карточек используй единый point/place template:
  fullscreen в доступной app content-area с видимыми header/footer, hero-фото около
  70% карточки, затем название/мета, координаты с copy, переход к статье/странице,
  раскрываемая навигация по картографическим системам и существующие действия
  вроде "мои точки".
- В point/place template навигация должна явно включать минимум: Google Maps,
  Apple Maps, Organic Maps/offline, Waze, Яндекс Карты, Яндекс Навигатор и
  OpenStreetMap. Telegram/share не заменяет навигационные системы.
- Связанные travel-статусы должны быть понятны текстом: "Был здесь",
  "Хочу поехать" и "Планирую" (или компактная строка "Был / Хочу / Планирую"
  рядом с действием). Нельзя оставлять это только безымянной иконкой.
- На travel details клик по карточке/картинке точки должен фокусить карту и
  подсвечивать/поднимать маркер, но не открывать popup автоматически; popup/card
  открывается от явного клика по маркеру на карте.
- Плейсхолдер изображения должен быть нейтральным:
  - без эмодзи, иконок и текста вроде "нет изображения";
  - с сохранением геометрии исходного медиа.
- Для опубликованных travel/article медиа (обложки, изображения в описании, галерея, фото точек на карте) не генерируй плоские SVG, Playwright-скриншоты, векторные/схематичные, мультяшные или placeholder-картинки.
  - Используй только реальные фото, явно разрешённые licensed/local фото или фотореалистичные generated raster images, сохранённые локальным файлом перед upload.
  - Если подходящую фотореалистичную картинку нельзя получить, не подменяй её стилизованной заглушкой; зафиксируй blocker.
- При задачах со статьями и квестами можно самостоятельно добавлять, генерировать и загружать только изображения/медиа для статьи, точек или квеста. Если для результата нужно написать, дописать, переписать или творчески улучшить текст статьи/квеста, сначала переспроси пользователя и не выполняй такую текстовую правку без отдельного явного подтверждения после вопроса.
- В web rich-text валидные Instagram post/reel/tv должны показываться встроенными постами; fallback-карточки допустимы только для неembed-ссылок вроде stories/highlights/profile или неподдержанных контекстов.

### 4.3 Иконки

- В production UI не используй эмодзи как иконки.
- Предпочтительный набор иконок: `@expo/vector-icons/Feather`.
- Не копируй имена иконок между разными семействами.
- Перед новым семейством иконок проверь корректный рендер на web без Metro stub-конфликтов.

### 4.4 Дизайн-токены

- Не хардкодь цвета hex-значениями в компонентах.
- Используй `DESIGN_TOKENS` из `constants/designSystem.ts`.
- CSS-переменные web живут в `app/global.css`.

### 4.5 Многоязычность

- Новый app-owned UI text не хардкодь: используй `useTranslation()` из
  `@/i18n`, а вне React — `translate()`/`getFixedTranslator()`.
- Любой новый translation key добавляй в RU/BE/UK/PL/EN в одной задаче;
  RU resources — типизированный key baseline.
- Даты, числа, валюты, списки, relative time, plural и sorting форматируй
  через `i18n/format.ts`; не хардкодь `ru-RU` и не пиши plural rules через `%`.
- Не переводи на клиенте user/editorial/API content, названия мест,
  комментарии, сообщения и stable backend codes; для этого нужен отдельный
  content-locale/API contract.
- Правки i18n provider/config/storage, SEO locale и shared copy проверяй на web
  hydration и native cold restart. При любом localization impact запусти
  `npm run test:i18n` плюс проверки по feature scope.

## 5. Производительность и релиз

### 5.1 Локально перед деплоем

- Собирай web в production-режиме:
  - `npm run build:web:prod`
- Lighthouse запускай по production-сборке, а не по dev-серверу.
- Правки travel hero/slider/details, `ImageCardMedia`, hero overlays/decode gates, lazy/content-visibility или responsive image layout обязаны пройти обе стороны контракта: `npm run verify:slider` и `npm run verify:slider-perf`, каждый запуск — через общий `scripts/run-with-quality-gate-lock.js`.

### 5.2 После деплоя

- Проверяй performance по реальному URL `https://metravel.by`.
- Не возвращай runtime/static service worker caching и сценарии "очистите кэш после релиза".

## 6. Правила качества кода

- Делай маленькие, читаемые, локальные изменения.
- Удаляй мертвый/неиспользуемый код, если он явно обнаружен в зоне задачи.
- Если в ходе работы найдена реальная ошибка, исправь ее в рамках текущей задачи; исключение только для проблем вне scope или без доступной проверки, тогда явно зафиксируй блокер и не маскируй проблему.
- Не создавай новые отчеты без необходимости: обновляй существующую документацию в `docs/`.
- Новые FE/BE/backend задачи создавай на общем MCP task board через `ticket-board` по правилам `docs/TASK_BOARD_MCP.md`.
- Каждая задача на борде должна содержать Task Contract, sprint, область (`front`/`back`), platform/localization impact и явные зависимости/блокеры; для этого используй `$metravel-task-contract`.
- На борде используются только рабочие области `front` и `back`: Android/native
  баги приложения заводи как `area=front` с префиксом `[AND-...]` и парной
  mobile-web/Android validation в описании; backend/API/server задачи заводи как `area=back`.
- Не создавай новые локальные `tasks/*.md` как обычный workflow. Локальные task-файлы допустимы только как временный fallback/migration draft при недоступном борде, после чего задачу нужно перенести на борд и убрать локальный черновик.
- Все новые задачи, включая Android QA баги, должны быть созданы или обновлены на борде в текущем активном спринте до handoff; локальный fallback не считается завершением задачи, если board token можно обновить через `.env.e2e`.

## 7. Мини-чеклист перед завершением задачи

- Изменения ограничены scope задачи.
- Запущены проверки по масштабу задачи.
- Не нарушены правила external links и governance.
- UI-поведение не сломано на desktop web/mobile web/Android.
- Platform impact проверен для desktop web/mobile web/Android; mobile web и
  Android подтверждены парным evidence, а непроверенный Android device scope
  явно помечен `verify pending`.
- Localization impact явно указан; для затронутого UI нет новых
  hardcoded strings, а `npm run test:i18n` прошёл.
- Документация обновлена только при необходимости и в правильном месте.
