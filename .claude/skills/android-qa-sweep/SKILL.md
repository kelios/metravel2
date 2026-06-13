---
name: android-qa-sweep
description: Полный QA-обход Android-приложения MeTravel на физическом устройстве через adb — каждый экран/кнопка/линк со скринами, критическая оценка, тикеты на MCP-борд, затем фиксы с верификацией на устройстве. Триггеры — «прогони QA на андроиде», «протестируй приложение на телефоне», «прокликай все экраны».
---

# Android QA Sweep — пайплайн план → тест → борд → фикс → верификация

## Предусловия
1. Физическое устройство по USB, отладка включена. adb: `D:\metravel\tools\platform-tools\adb.exe` (`adb devices`).
2. Dev-client `by.metravel.app` установлен, Metro запущен (`npm start`), порт проброшен: `adb reverse tcp:8081 tcp:8081`.
3. В dev-client отключена плавающая кнопка DevTools (dev-меню → toggle «Tools button») — иначе перекрывает гамбургер.
4. Пользователь залогинен (e2e-аккаунт из `.env.e2e` через программный логин; пароль руками не вводить).

## Инструменты
Хелперы: `artifacts/android-qa/qa.ps1` (dot-source). Вызов из Bash:
`powershell -NoProfile -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; . D:/metravel/metravel2/artifacts/android-qa/qa.ps1; Nav 'about' 6; Shot '20-about'"`

- `Shot "имя" [delay]` — screencap → pull → авто-даунскейл до 1900px (НЕ редиректить вывод adb через `>` — PowerShell портит бинарники).
- `Nav "route" [delay]` — deeplink `metravel://<route>` (scheme из app.json — `metravel` с 2026-06-13; сборки до этой даты использовали `myapp`, для них подставляй `myapp://`).
- `Tap x y`, `Swipe x1 y1 x2 y2 [ms]`, `Back`, `TypeText "латиница"` (кириллицу adb не вводит).
- `Clickables "имя"` — uiautomator-дамп кликабельных с bounds. **Координаты тапов брать ТОЛЬКО из дампа** (скрины даунскейлены — координаты с них врут). Mojibake в выводе лечит `[Console]::OutputEncoding=UTF8`.
- Логи JS-ошибок: `adb logcat -d -s ReactNativeJS:E` — стектрейсы крашей и warnings с component stack.

## Ловушки (выучено на практике)
- **LogBox-тост лежит поверх таб-бара** (bounds ≈ [26,2156][1054,2281]) и перехватывает тапы по нижним табам — перед тапами по табам закрывать тост (крестик ≈ 996×2219). Мёртвую кнопку подтверждать только после закрытия тоста.
- **Лимит картинок API**: при множестве скринов в истории Read изображений начинает падать («max 2000 pixels»). Оценку скринов делегировать субагентам (android-expert) со свежим контекстом, либо работать сериями до ~30 скринов.
- Радиокнопки/тогглы иногда срабатывают со 2-го тапа — повторить перед записью бага.
- `uiautomator dump` может вернуть stale-XML («could not get idle state») — перепроверять скрином.
- Карты (Leaflet WebView) грузятся 4–10с — Nav с delay 8+.

## Карта экранов
Все роуты — `app/(tabs)/*.tsx`: index, map, search, travelsby, travels/[param], travel/[id], travel/new (визард 6 шагов), quests (+карта, +город, +деталка), articles, article/[id], profile, user/[id], favorites, history, subscriptions, messages, settings, export, userpoints, login, registration, set-password, accountconfirmation, about, contact, cookies, privacy, metravel, roulette, calendar, places + 404.

## Пайплайн
1. **План**: TaskCreate список фаз (статические экраны → интеракции → темы → тикеты → фиксы).
2. **Обход**: deeplink на каждый роут → `Shot` → оценка (вёрстка/тёмная+светлая тема/контраст/обрезки/пустые блоки/счётчики) → интеракции (каждая кнопка через `Clickables`+`Tap`, скроллы медленные 400–800мс И быстрые флики 150мс — инерционный скролл ломается отдельно, формы по шагам БЕЗ сохранения/отправки/удаления/логаута).
3. **Отчёт**: `artifacts/android-qa/QA_REPORT.md` — таблица «Статус обхода» + находки `### F-NN (severity) Заголовок` (critical/major/minor/info) со скринами. Краш → сразу `logcat -s ReactNativeJS:E` за стектрейсом и поиск корня в коде (web-only импорты — главный подозреваемый, см. `docs/NATIVE_COMPAT_RULES.md`).
4. **Борд**: агент `ticket-board` — тикеты `[android-qa] F-NN: суть`, area=front, спринт «Android Release», label android-qa; severity → приоритет. Дубли проверять по «android-qa» в заголовках. Ничего про бэк не править — area=back тикет.
5. **Фиксы**: по severity (critical → major → minor). Native-краши — агент `android-expert`; web-first: общие файлы не ломать ради native (несовместимость = `.web.tsx`/`.native.tsx` сплит), после правки общего файла — проверка web в браузере. Каждый фикс верифицировать повторным скрином на устройстве, тикет закрывать только после верификации.
6. **Регресс**: `npm run test:run` + `npm run typecheck` + `npm run lint` до зелёного.

## Запреты во время обхода
Логаут; удаление/изменение данных (корзины, «Очистить», «Сохранить»); отправка сообщений/форм/публикация; платежи. Просмотр, навигация, листание визарда «Далее» без сохранения — можно.
