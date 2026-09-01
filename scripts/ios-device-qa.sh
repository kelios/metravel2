#!/usr/bin/env bash
# iOS Device QA helpers — живой iPhone по USB/Wi-Fi через devicectl (Xcode 26).
# Использование: source scripts/ios-device-qa.sh   (потом Devices/Unlocked/Launch/...)
# Регламент обхода: .claude/skills/ios-device-qa/SKILL.md
#
# ВАЖНО: у devicectl НЕТ screenshot — снимок экрана устройства берётся XCUITest-обвязкой
# или зеркалированием (см. SKILL.md, раздел «Скриншоты»). simctl здесь не работает вообще.

IOS_QA_BUNDLE="${IOS_QA_BUNDLE:-by.metravel.app}"
IOS_QA_OUT="${IOS_QA_OUT:-/tmp/ios-device-qa}"
IOS_QA_PROC="${IOS_QA_PROC:-metravel}"   # имя цели Xcode = имя процесса на устройстве
mkdir -p "$IOS_QA_OUT"

# Резолв устройства. State в `list devices` НЕ стабилен: до первого туннеля строка
# показывает `available (paired)`, после — `connected`; отбираем всё, кроме `unavailable`.
_pick() {
  xcrun devicectl list devices 2>/dev/null | awk '
    /unavailable/ { next }
    { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-/) { print $i; exit } }'
}

_dev() {
  if [ -z "$IOS_QA_DEVICE" ]; then IOS_QA_DEVICE="$(_pick)"; fi
  if [ -z "$IOS_QA_DEVICE" ]; then
    echo "нет доступного устройства: подключи iPhone, разблокируй и подтверди Trust (Devices)" >&2
    return 1
  fi
  printf '%s' "$IOS_QA_DEVICE"
}

# Вызывать первой: печатает список и кэширует устройство в текущей оболочке
# (внутри других функций резолв идёт в подоболочке и не сохраняется).
Devices() {
  xcrun devicectl list devices
  export IOS_QA_DEVICE="${IOS_QA_DEVICE:-$(_pick)}"
  echo "device=${IOS_QA_DEVICE:-<не найдено>}"
}

UseDevice() { export IOS_QA_DEVICE="$1"; echo "device=$IOS_QA_DEVICE"; }

# Достоверная проба блокировки (Xcode 26). Раньше её не было и приходилось
# запускать UI-тест ради строки "Unlock iPhone" — теперь не нужно.
# passcodeRequired=true → экран заблокирован, XCUITest и долгий прогон умрут посередине.
Unlocked() {
  local d; d="$(_dev)" || return 1
  xcrun devicectl device info lockState --device "$d" 2>/dev/null | grep -E 'passcodeRequired|unlockedSinceBoot'
  xcrun devicectl device info displays --device "$d" 2>/dev/null | grep -i 'backlight'
}

# Установленная сборка: version + buildNumber. Пустой вывод = приложения на устройстве нет.
AppInfo() {
  local d; d="$(_dev)" || return 1
  xcrun devicectl device info apps --device "$d" --bundle-id "$IOS_QA_BUNDLE" 2>/dev/null | tail -4
}

# Геометрия экрана: bounds в px, pointScale → координаты для тапов считаем в ПУНКТАХ.
Screen() {
  local d; d="$(_dev)" || return 1
  xcrun devicectl device info displays --device "$d" 2>/dev/null \
    | grep -E 'bounds|pointScale|currentOrientation|orientation'
}

Install() { # Install path/to/App.app  (или .ipa)
  local d; d="$(_dev)" || return 1
  xcrun devicectl device install app --device "$d" "$1"
}

# Переустановка НЕ обнуляет privacy-разрешения (TCC переживает uninstall) — см. SKILL.md.
Uninstall() {
  local d; d="$(_dev)" || return 1
  xcrun devicectl device uninstall app --device "$d" "$IOS_QA_BUNDLE"
}

Launch() { # Launch  — холодный старт поверх уже запущенного
  local d; d="$(_dev)" || return 1
  xcrun devicectl device process launch --device "$d" \
    --terminate-existing --activate "$IOS_QA_BUNDLE" 2>&1 | tail -3
}

# Диплинк и Universal Link. Именно тут проверяется AASA — на симуляторе openurl этого НЕ доказывает.
Open() { # Open metravel://map | Open https://metravel.by/travels/<slug>
  local d; d="$(_dev)" || return 1
  xcrun devicectl device process launch --device "$d" \
    --terminate-existing --activate --payload-url "$1" "$IOS_QA_BUNDLE" 2>&1 | tail -3
}

# Фоновый запуск с потоком stdout/stderr приложения в файл. Без него «крашей нет» —
# не утверждение, а отсутствие проверки: падение в фоне видно только в логе.
Console() { # Console [имя-лога]
  local d; d="$(_dev)" || return 1
  local f="$IOS_QA_OUT/${1:-console}.log"
  ( xcrun devicectl device process launch --device "$d" \
      --terminate-existing --activate --console "$IOS_QA_BUNDLE" >"$f" 2>&1 & )
  echo "лог пишется в $f (tail -f)"
}

# В таблице процессов бандла НЕТ — там путь к исполняемому файлу
# (`/…/metravel.app/metravel`), поэтому ищем по имени цели, а не по bundle id.
Pid() {
  local d; d="$(_dev)" || return 1
  xcrun devicectl device info processes --device "$d" 2>/dev/null \
    | awk -v n="${IOS_QA_PROC:-metravel}" '$2 ~ ("/" n "\\.app/") {print $1; exit}'
}

Kill() {
  local d p; d="$(_dev)" || return 1; p="$(Pid)"
  [ -z "$p" ] && { echo "процесс не найден"; return 0; }
  xcrun devicectl device process terminate --device "$d" --pid "$p" 2>&1 | tail -2
}

Orient() { # Orient p|pu|ll|lr   (без аргумента — текущая)
  local d; d="$(_dev)" || return 1
  [ -z "$1" ] && { xcrun devicectl device orientation get --device "$d" 2>&1 | tail -2; return; }
  xcrun devicectl device orientation set --device "$d" "$1" 2>&1 | tail -2
}

# Выгрузка файла из контейнера приложения (кэш, база, экспортированный PDF).
Pull() { # Pull Documents/file.pdf [локальный-путь]
  local d; d="$(_dev)" || return 1
  xcrun devicectl device copy from --device "$d" \
    --domain-type appDataContainer --domain-identifier "$IOS_QA_BUNDLE" \
    --source "$1" --destination "${2:-$IOS_QA_OUT/$(basename "$1")}"
}

# Краш-репорты Xcode синхронизирует в этот каталог; свежесть проверять по дате.
Crashes() {
  local dir="$HOME/Library/Logs/CrashReporter/MobileDevice"
  [ -d "$dir" ] || { echo "нет $dir — открой Xcode → Devices, чтобы он синхронизировал логи"; return 0; }
  find "$dir" -name "*$IOS_QA_BUNDLE*" -o -name "*MeTravel*" 2>/dev/null | tail -10
}
