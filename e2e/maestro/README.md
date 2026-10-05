# Maestro — device E2E flows (Android/iOS)

Воспроизводимые UI-сценарии на реальном устройстве/эмуляторе. Дополняют ручной Android
USB/dev-client проход из `docs/MANUAL_TEST_CASES.md` (`AND-USB-*`) и skill
`$metravel-mobile-tester`: ручной `adb` — для исследования и разовых проверок, Maestro — для
повторяемых регресс-сценариев (`tapOn: text`, `assertVisible`, авто-ретраи, скрины).

## Установка (УЖЕ ВЫПОЛНЕНО на этой машине — 2026-06-22)
- Maestro **2.6.1** → `~/.maestro/bin` (установщик добавил себя в `~/.zshrc`/`~/.bash_profile`).
- Java: **OpenJDK 17** через brew (`/opt/homebrew/opt/openjdk@17/...`). Maestro его НЕ видит без `JAVA_HOME`.

Повторная установка на другой машине:
```bash
brew install openjdk@17
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Что нужно один раз сделать ВАМ (Java для maestro в любом терминале)
Maestro находит `maestro` в PATH, но НЕ находит Java. Добавьте в `~/.zshrc` (я ваши dotfiles не правлю):
```bash
export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
```
Альтернатива (системно, нужен sudo — выполните сами):
```bash
sudo ln -sfn "$(brew --prefix openjdk@17)/libexec/openjdk.jdk" /Library/Java/JavaVirtualMachines/openjdk-17.jdk
```

## Предусловия
- Устройство по USB (`adb devices -l`) ИЛИ эмулятор; `by.metravel.app` установлен.
- **dev-client:** Metro запущен (`npm start`); `launch.yaml` сам подключит bundle (тап по dev-серверу `…8081` или deep-link к `127.0.0.1:8081`). **standalone preview/release-сборка надёжнее** — там `launchApp` сразу открывает приложение (на dev-client `launchApp` показывает лаунчер Expo).
- Три квестовых флоу (`quest-reviews`, `quest-intro-map-points`, `quest-offline-points`) запускать **гостем**. Каждый первым шагом открывает вкладку «Профиль» и падает на `assertVisible: "Войдите в аккаунт"` до сброса прогресса, чтобы не стереть прохождения аккаунта (на главной у гостя кнопки «Войти» нет — только «Открыть меню», поэтому страж стоит на «Профиле»). `apiUrl=https://metravel.by`.
- Кириллицу Maestro 2.6.1 на Android не вводит (`inputText` → «Unicode character input is not supported», issue #146), поэтому квестовые флоу не пользуются поиском: квест адресуется срезом каталога или deep link'ом по id.
- Остальные флоу, которым нужен аккаунт (полки рекомендаций), — тест-аккаунт sergey@lyte.com.
- Тексты ассертов — русские (UI на русском). Лейблы кнопок — из `accessibilityLabel`.
- Если Java недоступна для Maestro, не помечай device QA как зелёный: зафиксируй blocker и
  вручную пройди соответствующие `AND-USB-*` кейсы через `adb`/устройство.

## Запуск
Java нужно дать maestro через окружение (если не сделали системный симлинк):
```bash
export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export PATH="$HOME/.maestro/bin:$JAVA_HOME/bin:$PATH"

maestro test e2e/maestro/quest-reviews.yaml
maestro test e2e/maestro/quest-intro-map-points.yaml
maestro test e2e/maestro/quest-offline-points.yaml
maestro test e2e/maestro/recommendation-shelves.yaml
maestro test e2e/maestro/            # все сразу
```

## Flows
| Flow | Что проверяет | Статус |
|---|---|---|
| `quest-reviews.yaml` | «Выбрать город» → срез «Квесты с отзывами» → чип отзывов карточки «Квест по Гомелю…» (ratingCount > 0) → модалка → крестик. Не позиция каталога | гость, квест id 15. зелёный на 2026-10-05, release `1a5f86131`, эмулятор Pixel 3a API 34, гость; также на Pixel 10 Pro (сборка `b40f39bf9`) |
| `quest-intro-map-points.yaml` | Deep link `metravel://quests/krakow/krakow-dragon` → «Квест по Кракову: Вавельский дракон» (9 точек, 6 заданий) → сброс → «Задания: 0 / 6» → intro-карта до старта. Сброс только этого гостевого прогресса | гость, квест id 1. зелёный на 2026-10-05, release `1a5f86131`, эмулятор Pixel 3a API 34, гость (на `b40f39bf9` был красным — шапка под строкой состояния, починено #2234) |
| `quest-offline-points.yaml` | Тот же квест Кракова по deep link → GPX / открыть в картах → share с .gpx | гость, квест id 1. зелёный на 2026-10-05, release `1a5f86131`, эмулятор Pixel 3a API 34, гость: лист «⋯» — сброс, GPX, share с `.gpx`, «Открыть точки квеста в приложении карт» |
| `recommendation-shelves.yaml` | Полки Хочу поехать/Недавно смотрели на Маршрутах | ✅ зелёный на 2026-07-05 |

## Заметки
- `recommendation-shelves.yaml` использует dev-client deep-link fallback, потому что Expo Dev
  Launcher не всегда показывает auto-discovered сервер `8081`.
- Шапка прохождения квеста — кнопки по `accessibilityLabel`. С #2148 на телефоне действия
  живут в строке экрана: офлайн-загрузка — иконка «Скачать квест для офлайна», остальное
  (размер шрифта, печать, GPX, «Открыть точки квеста в приложении карт», отзывы, сброс) —
  пункты «⋯» (кнопка «Ещё действия», `more-horizontal`); печать в листе — где она доступна.
  Флоу открывает лист перед каждым таким действием: он закрывается сам при выборе строки.
  Если добавите явные `testID` — заменить на `id:` (`screen-header-more`, `quest-menu-*`).
- Системный share-лист — это OS UI; Maestro его видит (ассерт по `.gpx`/тексту).
- 2026-10-05, release из `b40f39bf9`, Pixel 10 Pro (гость, прод-API): на вложенных экранах
  (квест, путешествие) шапка экрана лежит под системной строкой состояния — кнопки «Назад»,
  «Скачать квест для офлайна», «Ещё действия» занимают y=11–126 px при инсете 172 px, на тапы
  не реагируют, Maestro заголовок и кнопки шапки не видит. Поэтому `quest-intro-map-points` и
  `quest-offline-points` падают на первом элементе шапки (заголовок квеста после deep link);
  шаги до шапки (страж гостя, deep link) зелёные, карта проверена вручную дампом: «Карта
  квеста», «9 точек на карте», маркеры 1–9. Шаги листа «⋯» (сброс, «ОК», GPX, share) на этой
  сборке не проверены — перепрогнать оба флоу после починки шапки и заменить статус в таблице.
- 2026-10-05, release из `1a5f86131` (#2234 — отступ шапки из safe area), эмулятор Pixel 3a
  API 34 (1080×2220, гость, прод-API): все три квестовых флоу зелёные, включая шаги листа «⋯»
  (сброс прогресса → «ОК» → «Задания: 0 / 6», GPX → системный share с `.gpx`, «Открыть точки
  квеста в приложении карт»). Запись выше про `b40f39bf9` — история причины, а не текущий статус.
- Чистая установка показывает онбординг поверх главной, и он перехватывает тапы по доку:
  `launch.yaml` пропускает его необязательным шагом «Пропустить онбординг».
- На эмуляторе рядом может стоять старый `by.metravel.app.debug` с теми же схемами `metravel://`
  и `exp+metravel://`: deep link тогда открывает системный выбор «Open with», и флоу падает на
  ожидании главной. Перед прогоном: `adb -s emulator-5554 shell pm disable-user --user 0
  by.metravel.app.debug` (вернуть — `pm enable by.metravel.app.debug`).
- Подпись release-сборки и dev-client разная: `install -r` поверх dev-client отказывает
  (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) — пакет сначала удаляется, вход в нём пропадает.
