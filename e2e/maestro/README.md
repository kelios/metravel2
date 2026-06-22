# Maestro — device E2E flows (Android/iOS)

Воспроизводимые UI-сценарии на реальном устройстве/эмуляторе. Дополняют ручной adb-проход
(`artifacts/android-qa/qa.sh` + skill `android-qa-sweep`): qa.sh — для исследования и
разовых проверок, Maestro — для повторяемых регресс-сценариев (`tapOn: text`, `assertVisible`,
авто-ретраи, скрины), куда надёжнее сырого uiautomator.

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
- **dev-client:** Metro запущен (`npm start`); `launch.yaml` сам подключит bundle (тап по dev-серверу `…8081`). **standalone preview/release-сборка надёжнее** — там `launchApp` сразу открывает приложение (на dev-client `launchApp` показывает лаунчер Expo).
- Залогинен тест-аккаунтом sergey@lyte.com; `apiUrl=https://metravel.by`.
- Тексты ассертов — русские (UI на русском). Лейблы кнопок — из `accessibilityLabel`.

## Запуск
Java нужно дать maestro через окружение (если не сделали системный симлинк):
```bash
export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export PATH="$HOME/.maestro/bin:$JAVA_HOME/bin:$PATH"

maestro test e2e/maestro/quest-reviews.yaml          # ✅ проверено зелёным 2026-06-22
maestro test e2e/maestro/quest-offline-points.yaml
maestro test e2e/maestro/recommendation-shelves.yaml
maestro test e2e/maestro/            # все сразу
```

## Flows
| Flow | Что проверяет | Статус |
|---|---|---|
| `quest-reviews.yaml` | Чип «💬 N» → модалка отзывов (не старт квеста) | ✅ зелёный на 2026-06-22 |
| `quest-offline-points.yaml` | Скачать GPX / открыть в приложении → share с .gpx (не тост ошибки) | ✅ зелёный на 2026-06-22 |
| `recommendation-shelves.yaml` | Полки Избранное/Недавно смотрели на Маршрутах | ⚠️ ПАДАЕТ — открытый баг рендера полок (data есть, рендера нет) |

## Заметки
- `recommendation-shelves.yaml` сейчас красный намеренно — это регресс-детектор открытого бага
  (полки favorites/history не рендерятся на native, хотя `[QA-STATE]` показывает fav:4/hist:20).
  Закроется зелёным, когда баг рендера починят.
- Топ-бар деталки квеста — кнопки по `accessibilityLabel` («Скачать GPX с N точками квеста»,
  «Открыть точки квеста в приложении карт»). Если добавите явные `testID` — заменить на `id:`.
- Системный share-лист — это OS UI; Maestro его видит (ассерт по `.gpx`/тексту).
