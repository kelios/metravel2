#!/bin/bash
set -Eeuo pipefail
IFS=$'\n\t'

# Keep the build mutex for the complete build + SEO + deploy lifecycle. The
# inner invocation and build-web-safe.js inherit MT_BUILD_LOCK_OWNED=1.
if [[ "${MT_BUILD_LOCK_OWNED:-0}" != "1" ]]; then
  exec node scripts/run-with-build-lock.js -- "$0" "$@"
fi

if [[ -d "$HOME/.local/bin" ]]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

# Node 22 и GNU rsync в PATH. Без этого деплой падает на `yarn install` через
# минуту после старта: на рабочей машине `/opt/homebrew/bin/node` — симлинк на
# node@20, нужный node@22 стоит keg-only, а менеджера версий нет, поэтому
# `.nvmrc`/`.node-version` в репозитории никто не читает. Раньше PATH правили
# руками перед каждым запуском и регулярно забывали.
# shellcheck source=scripts/use-node.sh
source "$(dirname "${BASH_SOURCE[0]}")/scripts/use-node.sh"

# Адрес прод-сервера не зашит в скрипт: репозиторий публичный. Реквизиты
# приходят из .env.deploy или окружения — см. scripts/deploy-target.sh.
# shellcheck source=scripts/deploy-target.sh
source "$(dirname "${BASH_SOURCE[0]}")/scripts/deploy-target.sh"

# Единая уборка на выходе. Раньше EXIT-trap ставили внутри build_env и
# deploy_prod, и каждый следующий затирал предыдущий, поэтому отдельный trap на
# .env до конца цикла бы не дожил. Все временные пути объявлены глобально: trap
# выполняется на верхнем уровне и `local`-переменные функций там не видны.
EXPORT_LOG=''
ENV_BACKUP=''
ENV_BACKUP_PRESENT=0
BUILD_SOURCE_SHA=''
SOURCE_ALREADY_LIVE=0
# #3210: sha релиза, который уже переключён на проде (publish-code), но ещё не
# подтверждён живыми проверками и finalize-code. Пока он не пуст, любой выход —
# ошибка, сигнал, обрыв обёртки — обязан вернуть предыдущую пару.
PUBLISH_UNCONFIRMED_SHA=''
# #3334: идентификатор этой публикации (бэкенд #3310). Один на выкат, выдаётся
# до publish-code и уходит в publish-code, finalize-code и rollback-code: receipt
# на хосте лежит по sha, и с идентификатором сервер не даст финализировать или
# вернуть публикацию той же ревизии из другой сессии. Пусто — помощник хоста
# протокол не объявил (capability), вызовы идут по-прежнему без него.
PUBLICATION_ID=''
# #3272, #3307: код сигнала, отложенного на время publish-code и finalize-code:
# исход серверной операции разбирается до выхода (см. defer_signals).
DEFERRED_SIGNAL=''
MEDIA_CHECKS_PID=''
MEDIA_CHECKS_LOG=''
STAGE_NAME=''
STAGE_STARTED_AT=0
STAGE_REPORT=''
SSR_EXPORT_DIR="$PWD/.codex-temp/deploy/ssr-export"
SSR_RELEASE_DIR="$PWD/.codex-temp/deploy/ssr-release"
SSR_CODE_RELEASE=0

# Время этапов (#2013). Выкат дорос до ~15 минут незаметно: длительность этапов
# нигде не печаталась. Каждый этап закрывается строкой «⏱ этап: N с», а на
# выходе — в том числе аварийном — печатается сводка, так что регресс времени
# виден в отчёте любого выката.
stage() {
  stage_done
  STAGE_NAME="$1"
  STAGE_STARTED_AT=$SECONDS
  echo "▶ $STAGE_NAME"
}

stage_done() {
  [[ -n "$STAGE_NAME" ]] || return 0
  local took=$((SECONDS - STAGE_STARTED_AT))
  echo "⏱  $STAGE_NAME: ${took} с"
  STAGE_REPORT+="$(printf '   %4d с  %s' "$took" "$STAGE_NAME")"$'\n'
  STAGE_NAME=''
}

print_stage_report() {
  stage_done
  [[ -n "$STAGE_REPORT" ]] || return 0
  echo "⏱  Время этапов:"
  printf '%s' "$STAGE_REPORT"
  echo "⏱  Итого: ${SECONDS} с"
}

# Медиа-проверки прода — в фоне экспорта. Они смотрят не выкатываемый
# фронтенд, а медиа из прод-API: `post-deploy-media-check.js` сверяет вес, кэш и
# ресайз по URL из `/api/travels/` и `/api/quests/` (#1195),
# `audit-article-body-media.js` щупает картинки тел статей (#1834, #1088).
# Выкат их результата не меняет, а в хвосте выката они добавляли 75 с. Экспорт
# грузит локальный CPU, эти проверки — сеть. Перед публикацией ждём их конца
# (#1966). Вердикт, как и прежде, сборку не валит.
start_prod_media_checks() {
  MEDIA_CHECKS_LOG="$(mktemp -t metravel-media-checks 2>/dev/null || mktemp /tmp/metravel-media-checks.XXXXXX)"
  (
    node scripts/post-deploy-media-check.js --url https://metravel.by \
      || echo "⚠️  Проверка медиа-контракта прода нашла замечания — посмотри: npm run test:media:postdeploy:verbose"
    node scripts/audit-article-body-media.js --url https://metravel.by \
      || echo "⚠️  В телах статей есть битые или осиротевшие картинки — посмотри: npm run test:media:body -- --verbose"
  ) >"$MEDIA_CHECKS_LOG" 2>&1 &
  MEDIA_CHECKS_PID=$!
}

finish_prod_media_checks() {
  [[ -n "$MEDIA_CHECKS_PID" ]] || return 0
  wait "$MEDIA_CHECKS_PID" || true
  MEDIA_CHECKS_PID=''
  echo "Медиа-проверки прода (фоновый этап):"
  cat "$MEDIA_CHECKS_LOG"
  rm -f "$MEDIA_CHECKS_LOG"
  MEDIA_CHECKS_LOG=''
}

stop_prod_media_checks() {
  [[ -n "${MEDIA_CHECKS_PID:-}" ]] || return 0
  pkill -P "$MEDIA_CHECKS_PID" 2>/dev/null || true
  kill "$MEDIA_CHECKS_PID" 2>/dev/null || true
  MEDIA_CHECKS_PID=''
}

# .env общий для всех параллельных сессий в этом чекауте, а apply_env копирует
# поверх него .env.$ENV. Без возврата исходника соседняя сессия молча получала
# прод-конфиг: 08.09.2026 прерванная сборка оставила APP_ENV=production рядом с
# мёртвым EXPO_PUBLIC_API_URL от чужого e2e-прогона (#1881).
restore_env_file() {
  local backup="$ENV_BACKUP"

  [[ -n "$backup" ]] || return 0
  ENV_BACKUP=''

  if [[ "$ENV_BACKUP_PRESENT" == "1" ]]; then
    if cp -p "$backup" .env; then
      echo "♻️  .env восстановлен в исходное состояние"
    else
      echo "⚠️  Не удалось восстановить .env — исходная копия осталась в $backup"
      return 0
    fi
  else
    rm -f .env
    echo "♻️  .env удалён: до сборки его в дереве не было"
  fi

  rm -f "$backup"
}

# Окно плановой нагрузки прода (#2663): выкат объявляет монитору хоста, что
# 10–12 минут 100 % CPU единственного ядра — его плановая работа, а не авария.
# Открывается только настоящим выкатом на прод, снимается в on_exit при любом
# исходе; сбой не роняет выкат — монитор тогда просто пришлёт письмо, как раньше.
PLANNED_LOAD_OPEN=0
PLANNED_LOAD_TTL_SECONDS="${PLANNED_LOAD_TTL_SECONDS:-1200}"

open_planned_load_window() {
  [[ "$DEPLOY" == "1" && "$ENV" == "prod" ]] || return 0
  if bash scripts/prod-planned-load.sh open frontend-deploy "$PLANNED_LOAD_TTL_SECONDS" \
    "frontend-deploy:${BUILD_SOURCE_SHA:0:12}" </dev/null; then
    PLANNED_LOAD_OPEN=1
    echo "🛠  Окно плановой нагрузки на проде: $((PLANNED_LOAD_TTL_SECONDS / 60)) мин"
  else
    echo "⚠️ Окно плановой нагрузки на проде не открыто — монитор хоста может прислать письмо о CPU"
  fi
}

close_planned_load_window() {
  [[ "$PLANNED_LOAD_OPEN" == "1" ]] || return 0
  PLANNED_LOAD_OPEN=0
  bash scripts/prod-planned-load.sh close frontend-deploy </dev/null ||
    echo "⚠️ Окно плановой нагрузки на проде не снято — истечёт само"
}

# Возврат переключённого, но не подтверждённого релиза (#3210). Вызывается из
# ветки провала живых проверок и из on_exit: до #3210 возврат стоял только в
# ветке ошибки, поэтому SIGTERM между publish-code и концом проверок (тайм-аут
# обёртки, остановка сессии) оставлял на проде непроверенную версию. Отметка
# снимается до вызова — второй раз тот же релиз не возвращается.
rollback_unconfirmed_release() {
  local sha="$PUBLISH_UNCONFIRMED_SHA" rollback_status=0
  local rollback_args=("$sha") rollback_command="rollback-code $sha"

  [[ -n "$sha" ]] || return 0
  PUBLISH_UNCONFIRMED_SHA=''
  if [[ -n "$PUBLICATION_ID" ]]; then
    rollback_args+=(--publication-id "$PUBLICATION_ID")
    rollback_command+=" --publication-id $PUBLICATION_ID"
  fi
  echo "⚠️  Релиз ${sha:0:9} переключён, но не подтверждён — возвращаю связанную серверную и клиентскую версию"
  bash scripts/web-ssr-publication.sh rollback-code "${rollback_args[@]}" || rollback_status=$?
  if [[ "$rollback_status" == "0" ]]; then
    echo "✅ Возврат выполнен: прод снова отдаёт предыдущий релиз"
    return 0
  fi
  # #3334: код 77 — сервер ответил publication_mismatch: receipt этой ревизии не
  # принадлежит нашей публикации (его ведёт другая сессия, его нет либо релиз
  # уже принят). Отказ до записи: возвращать нечего, ручной возврат не нужен.
  if [[ "$rollback_status" == "77" ]]; then
    echo "⚠️  Возврат не выполнялся: сервер отказал до записи — receipt ревизии ${sha:0:9} не принадлежит этой публикации (причина — строкой выше), прод этим вызовом не менялся"
    echo "   Ручной возврат не нужен. Сверь https://metravel.by/.build-source.json: чужую публикацию примет или вернёт её сессия."
    return 0
  fi
  echo "❌ НУЖЕН РУЧНОЙ ВОЗВРАТ: rollback-code $sha не прошёл."
  echo "   Сверь https://metravel.by/.build-source.json и повтори: bash scripts/web-ssr-publication.sh $rollback_command"
  echo "   Если finalize-code успел завершиться, релиз уже принят и проверен: бэкенд его не возвращает, прод цел."
  echo "   (docs/WORKFLOW_OPERATIONS.md → «Аварийный возврат прошлой версии»)"
  return 1
}

# Сигнал на время серверной операции откладывается: обработчик выхода решает
# по отметке PUBLISH_UNCONFIRMED_SHA, возвращать ли релиз, а отметка верна только
# после разбора исхода операции. resume_signals возвращает обычные ловушки;
# отложенный код вызывающий отдаёт сам через `exit "$DEFERRED_SIGNAL"`.
defer_signals() {
  DEFERRED_SIGNAL=''
  trap 'DEFERRED_SIGNAL=130' INT
  trap 'DEFERRED_SIGNAL=143' TERM
  trap 'DEFERRED_SIGNAL=129' HUP
}

resume_signals() {
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
}

on_exit() {
  local status=$?

  trap - EXIT
  # Уборка неразрывна: второй Ctrl-C, пришедший посреди `cp` в
  # restore_env_file, иначе бросил бы общий .env прод-копией — ENV_BACKUP к
  # этому моменту уже обнулён, и повторной попытки не будет.
  trap '' INT TERM HUP
  if [[ -n "$PUBLISH_UNCONFIRMED_SHA" ]]; then
    # Первым делом: сайт важнее уборки. Выход с неподтверждённым релизом
    # успехом не бывает, даже если возврат прошёл.
    rollback_unconfirmed_release || true
    [[ "$status" != "0" ]] || status=1
  fi
  print_stage_report || true
  stop_prod_media_checks
  close_planned_load_window || true
  if [[ -n "${MEDIA_CHECKS_LOG:-}" ]]; then
    rm -f "$MEDIA_CHECKS_LOG"
  fi
  if [[ -n "${EXPORT_LOG:-}" ]]; then
    rm -f "$EXPORT_LOG"
  fi
  restore_env_file
  exit "$status"
}

trap on_exit EXIT
# Без явных обработчиков сигналов bash умирает, не выполнив EXIT-trap: после
# Ctrl-C или kill общий .env остался бы прод-копией.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Гейт источника сборки. build-prod.sh собирает физическое содержимое рабочего
# каталога, а в этом чекауте одновременно работают до восьми сессий и почти
# всегда что-то не закоммичено. 08.09.2026 запуск из общего дерева утащил в
# сборку 29 продуктовых файлов чужой задачи, висевшей in_progress (#1881).
# Проверка идёт до install_deps и сборки, поэтому стоп ничего не стоит.
assert_deployable_source() {
  local env_name="$1"
  local allow_dirty="$2"
  local deploying="$3"
  local gate_js="${METRAVEL_SOURCE_GATE_JS:-}"
  local here

  if [[ -z "$gate_js" ]]; then
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    gate_js="$here/scripts/assert-deployable-source.js"
  fi
  # #3207: выкат дополнительно сверяется с живой ревизией прода. Код 3 —
  # «эта ревизия уже выкачена»: не ошибка, но собирать и публиковать нечего.
  local gate_status=0
  node "$gate_js" --env "$env_name" --allow-dirty "$allow_dirty" --deploy "$deploying" \
    --live-check "$deploying" --cwd "$(pwd)" || gate_status=$?
  if [[ "$gate_status" == "3" ]]; then
    SOURCE_ALREADY_LIVE=1
  elif [[ "$gate_status" != "0" ]]; then
    return 1
  fi
  BUILD_SOURCE_SHA="$(git rev-parse HEAD)"
}

apply_env() {
  local ENV="$1"

  if [[ "$ENV" != "dev" && "$ENV" != "prod" && "$ENV" != "preprod" ]]; then
    echo "❌ Укажи dev, preprod или prod"
    exit 1
  fi

  if [[ ! -f ".env.$ENV" ]]; then
    echo "❌ Файл .env.$ENV не найден"
    exit 1
  fi

  if [[ -z "$ENV_BACKUP" ]]; then
    # ENV_BACKUP публикуется ПОСЛЕДНИМ, уже после снимка. Иначе между `mktemp` и
    # `ENV_BACKUP_PRESENT=1` открыто окно в несколько миллисекунд: сигнал,
    # пойманный в нём, запускает restore_env_file с непустым ENV_BACKUP и
    # дефолтным ENV_BACKUP_PRESENT=0 — и общий `.env` УДАЛЯЕТСЯ вместо
    # восстановления (воспроизводилось 10 раз из 32 прогонов kill -TERM).
    local snapshot
    local present=0
    snapshot="$(mktemp -t metravel-env-backup 2>/dev/null || mktemp "/tmp/metravel-env-backup.XXXXXX")"
    if [[ -f .env ]]; then
      cp -p .env "$snapshot"
      present=1
    fi
    ENV_BACKUP_PRESENT="$present"
    ENV_BACKUP="$snapshot"
  fi

  echo "📦 Применяю .env.$ENV → .env (исходный вернётся на выходе)"
  cp ".env.$ENV" .env
}

# Публичные флаги, которые задаёт сама сборка выката, а не локальный `.env.<env>`
# (#3292). `.env.*` в git не лежат и у каждой машины свои: 11.11.2026 выкат
# 73026204e с машины без строки `EXPO_PUBLIC_AI_SIMILAR_SOURCE=static` собрал
# сайт без блоков «Похожие» через четверть часа после их включения. Блоки читают
# статический слепок из репозитория (`public/assets/data/ai-similar.json`), службы
# не требуют — поэтому включены по умолчанию. Значение из окружения или из
# `.env.<env>` сильнее, в том числе пустое: строка `EXPO_PUBLIC_AI_SIMILAR_SOURCE=`
# выключает блоки.
apply_build_public_defaults() {
  local ENV="$1"

  if [[ -z "${EXPO_PUBLIC_AI_SIMILAR_SOURCE+set}" ]] &&
    ! grep -Eq '^[[:space:]]*EXPO_PUBLIC_AI_SIMILAR_SOURCE=' ".env.$ENV"; then
    export EXPO_PUBLIC_AI_SIMILAR_SOURCE=static
  fi
}

install_deps() {
  if [[ "${CLEAN:-0}" == "1" ]]; then
    echo "🧹 Чищу зависимости..."
    rm -rf node_modules package-lock.json
  fi
  echo "📦 Устанавливаю зависимости..."
  if yarn install --frozen-lockfile; then
    return 0
  fi
  # #3210: раньше здесь стояло `|| yarn install` — при расхождении package.json
  # с yarn.lock или сбое сети версии подбирались заново, уже после гейта
  # источника, и на прод уезжал код, которого нет ни в одном коммите.
  if [[ "${DEPLOY:-1}" == "1" ]]; then
    echo "❌ Строгая установка (yarn install --frozen-lockfile) не прошла — выкат остановлен, прод не менялся."
    echo "   На прод уходят только версии из yarn.lock собираемого коммита: расхождение с package.json чинится коммитом, сбой сети — повтором выката."
    return 1
  fi
  echo "⚠️  Строгая установка не прошла; это сборка без выката (DEPLOY=${DEPLOY:-}) — ставлю зависимости без yarn.lock, деплоить такой артефакт нельзя"
  yarn install
}

create_export_log() {
  local ENV="$1"
  mktemp -t "expo-export-${ENV}" 2>/dev/null || mktemp "/tmp/expo-export-${ENV}.XXXXXX"
}

# Кэш трансформов Metro (#2982). По умолчанию экспорт холодный (`-c`, свежий
# изолированный TMPDIR). Выкат (scripts/deploy-prod.sh) задаёт постоянный
# METRAVEL_METRO_CACHE_DIR своего фиксированного worktree: холодный экспорт
# под нагрузкой машины стоил 100–800 с при неизменных ~3860 модулях. Тёплый
# кэш безопасен, потому что каждый вход трансформа вне собственного ключа
# Metro — каталоги `i18n/locales`, межмодульные решения плагина локали,
# вшитый Expo-конфиг, EXPO_PUBLIC_*, инструментарий Babel — входит в
# `config.cacheVersion` (scripts/lib/metroCacheInputs.js). Смена lockfile,
# патчей или postinstall чистит каталог явно: старые записи всё равно
# недостижимы и только занимали бы диск; переполненный кэш тоже сносится.
METRO_CACHE_ARGS=(-c)
METRO_CACHE_MAX_KB=$((8 * 1024 * 1024))

prepare_metro_cache() {
  METRO_CACHE_ARGS=(-c)
  if [[ -z "${METRAVEL_METRO_CACHE_DIR:-}" ]]; then
    echo "🧊 Metro: холодный экспорт (-c)"
    return 0
  fi
  local transform_dir="$METRAVEL_METRO_CACHE_DIR/transform"
  local stamp_file="$METRAVEL_METRO_CACHE_DIR/toolchain.sha"
  local toolchain size_kb
  toolchain="$(node -e 'process.stdout.write(require("./scripts/lib/metroCacheInputs").getToolchainRevision(process.cwd()))')"
  if [[ "$(cat "$stamp_file" 2>/dev/null || true)" != "$toolchain" ]]; then
    if [[ -f "$stamp_file" ]]; then
      echo "🧹 Metro: lockfile, патчи или postinstall сменились — чищу кэш выката"
    fi
    rm -rf "$transform_dir"
  fi
  size_kb="$(du -sk "$transform_dir" 2>/dev/null | cut -f1 || true)"
  if [[ "${size_kb:-0}" -gt "$METRO_CACHE_MAX_KB" ]]; then
    echo "🧹 Metro: кэш выката $((size_kb / 1024)) МБ больше $((METRO_CACHE_MAX_KB / 1024)) МБ — чищу"
    rm -rf "$transform_dir"
  fi
  if [[ ! -d "$transform_dir" ]]; then size_kb=0; fi
  mkdir -p "$transform_dir"
  printf '%s' "$toolchain" >"$stamp_file"
  export EXPO_METRO_CACHE_OUTPUT_DIR="$transform_dir"
  METRO_CACHE_ARGS=()
  echo "♨️  Metro: тёплый кэш выката $transform_dir ($(( ${size_kb:-0} / 1024 )) МБ)"
}

build_env() {
  local ENV="$1"
  local DIR="dist/$ENV"
  EXPORT_LOG="$(create_export_log "$ENV")"

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env "$ENV"
  apply_build_public_defaults "$ENV"
  node scripts/generate-home-responsive-css.js --check
  prepare_metro_cache

  if [[ "${METRAVEL_WEB_OUTPUT:-static}" == "server" ]]; then
    rm -rf "$DIR" "$SSR_EXPORT_DIR" "$SSR_RELEASE_DIR"
    CI=1 EXPO_NO_INTERACTIVE=1 NODE_ENV=production EXPO_ENV="$ENV" \
      EXPO_NO_METRO_LAZY=true EXPO_PUBLIC_RNW_SLIM=1 \
      EXPO_WEB_BUILD_MINIFY=true EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
      node scripts/build-web-safe.js -p web ${METRO_CACHE_ARGS[@]+"${METRO_CACHE_ARGS[@]}"} --output-dir "$SSR_EXPORT_DIR" 2>&1 | tee "$EXPORT_LOG"
    node scripts/prepare-web-ssr.js --export-dir "$SSR_EXPORT_DIR" --static-dir "$DIR" \
      --runtime-dir "$SSR_RELEASE_DIR" --env-file ".env.$ENV"
    rm -f "$EXPORT_LOG"
    EXPORT_LOG=''
    return
  fi

  rm -rf "$DIR"
  # build-web-safe.js всегда экспортирует в dist/, потом переносим в dist/$ENV.
  # `! -name '.*'` сохраняет служебные dotdir другого (staging) флоу
  # (dist/.prod-staging, dist/.prod-build.lock) — иначе bash-флоу сметает их.
  find dist -mindepth 1 -maxdepth 1 ! -name "$ENV" ! -name '.*' -exec rm -rf {} + 2>/dev/null || true

  CI=1 \
  EXPO_NO_INTERACTIVE=1 \
  NODE_ENV=production \
  EXPO_ENV="$ENV" \
  EXPO_NO_METRO_LAZY=true \
  EXPO_PUBLIC_RNW_SLIM=1 \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    node scripts/build-web-safe.js -p web ${METRO_CACHE_ARGS[@]+"${METRO_CACHE_ARGS[@]}"} 2>&1 | tee "$EXPORT_LOG"

  if [[ ! -f "dist/index.html" ]]; then
    echo "❌ Сборка не завершилась: не найден dist/index.html"
    exit 1
  fi

  rm -f "$EXPORT_LOG"
  EXPORT_LOG=''

  # Переносим артефакты dist/* (кроме самой папки $ENV и служебных dotdir) в dist/$ENV
  mkdir -p "$DIR"
  find dist -mindepth 1 -maxdepth 1 ! -name "$ENV" ! -name '.*' -exec mv {} "$DIR/" \;

  if [[ ! -f "$DIR/index.html" ]]; then
    echo "❌ Не удалось перенести артефакты в $DIR"
    exit 1
  fi
}

verify_deployment_runtime() {
  local capability control_path capability_started=$SECONDS
  if ! capability="$(bash scripts/web-ssr-publication.sh capability)"; then
    echo "⏱ SSR capability: $((SECONDS - capability_started))s (failed)"
    return 1
  fi
  echo "⏱ SSR capability: $((SECONDS - capability_started))s"
  control_path="$(node -e 'process.stdout.write(require("./scripts/lib/webOutput").getQuestControlPath(JSON.parse(process.argv[1]), {allowUnavailable: true}) || "")' "$capability")" || return 1
  local args=(--sha "$BUILD_SOURCE_SHA")
  if [[ -n "$control_path" ]]; then args+=(--control-path "$control_path"); fi
  node scripts/verify-live-deployment-ssr.js "${args[@]}"
}

# Прод-выкат публикует только связанную пару SSR-релиза (#2766): серверный
# рендер и клиентскую статику одного экспорта. Статическая публикация поверх
# живого SSR запрещена (scripts/lib/webOutput.js), а откат SSR возвращает
# предыдущую SSR-пару, не статику.
deploy_prod() {
  local ENV="$1"
  if [[ "${SSR_CODE_RELEASE:-0}" != "1" || "$ENV" != "prod" ]]; then
    echo "❌ Выкат публикует только SSR-релиз prod (EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR=true)"
    return 1
  fi
  if ! bash scripts/web-ssr-publication.sh stage "$BUILD_SOURCE_SHA" "$SSR_RELEASE_DIR"; then
    # #2930: без этой строки отказ виден только как общий «web-ssr release
    # refused» хелпера бэкенда, а выкат — как обычное падение сборки.
    echo "❌ Сервер отклонил релиз ${BUILD_SOURCE_SHA:0:9} на stage — прод не менялся."
    echo "   Причина хелпера — строка «web-ssr release refused» выше; для sha, выкатанного и откатанного раньше, это неизменяемый releases/<sha> с другим digest (#2858)."
    return 1
  fi
  # #2980: one timer over the whole publication (121 s on 03.11) did not say
  # what to shorten; the sub-stages split the upload and the seal, the backend
  # swap with the live checks, and the finalize with the disk report.
  stage "выкат: переключение и живые проверки"
  # Коды `publish-code` «сервер отказал до записи» (scripts/web-ssr-publication.sh):
  # 75 — прод сменил ревизию, пока шёл выкат («нас обогнали»), с ним же выходит
  # выкат; 77 — receipt ревизии ведёт публикация другой сессии (#3334);
  # 78 — помощник хоста не принял --expect-current или --publication-id.
  local overtaken_exit=75 not_ours_exit=77 unsupported_exit=78
  local expect_current='' guard_status=0 publish_status=0 refused_exit=''
  local publish_args=("$BUILD_SOURCE_SHA") finalize_args=("$BUILD_SOURCE_SHA")
  local publication_capability=''
  # #3334: идентификатор публикации выдаётся до переключения и только помощнику,
  # который объявил протокол в capability: фронт выкатывается и раньше бэкенда
  # #3310. Capability читается здесь, а не берётся из проверки до сборки: решение
  # «с идентификатором или без» одно на publish-code, finalize-code и
  # rollback-code этой публикации и принимается вплотную к ней.
  PUBLICATION_ID=''
  if ! publication_capability="$(bash scripts/web-ssr-publication.sh capability)" ||
    ! PUBLICATION_ID="$(node -e 'process.stdout.write(require("./scripts/lib/webOutput").createCodePublicationId(JSON.parse(process.argv[1])))' "$publication_capability")"; then
    PUBLICATION_ID=''
    echo "❌ Capability бэкенда перед публикацией не прочитана — релиз ${BUILD_SOURCE_SHA:0:9} не опубликован, прод не менялся"
    return 1
  fi
  if [[ -n "$PUBLICATION_ID" ]]; then
    echo "🔖 Публикация ${BUILD_SOURCE_SHA:0:9}: --publication-id $PUBLICATION_ID"
    finalize_args+=(--publication-id "$PUBLICATION_ID")
  else
    echo "⚠️  Помощник хоста не объявил publication_id (бэкенд старее #3310): публикация идёт без привязки receipt к этой сессии"
  fi
  # #3307: сверка «цель содержит живую ревизию» из гейта источника к этому
  # моменту устарела на время сборки и заливки. 11.11.2026 два выката из разных
  # чекаутов прошли её оба, и предок переключил прод через 21 с после потомка.
  # Сверка повторяется вплотную к переключению, а прочитанная живая ревизия
  # уходит серверу (`--expect-current`, #3308): под своим замком он откажет,
  # если текущая пара сменилась уже после этого чтения. Пусто — только у
  # ALLOW_DOWNGRADE=1 без прочитанной живой ревизии: публикация без сверки.
  expect_current="$(node scripts/assert-deployable-source.js --publish-check "$BUILD_SOURCE_SHA" --cwd "$(pwd)")" || guard_status=$?
  if [[ "$guard_status" == "$overtaken_exit" ]]; then
    echo "❌ Выкат ${BUILD_SOURCE_SHA:0:9} остановлен до переключения: нас обогнали — прод сменил ревизию, пока шёл выкат. Наш релиз не опубликован, ничего не возвращалось (код $overtaken_exit)"
    return "$overtaken_exit"
  fi
  if [[ "$guard_status" != "0" ]]; then
    echo "❌ Живая ревизия перед публикацией не сверена — релиз ${BUILD_SOURCE_SHA:0:9} не опубликован, прод не менялся"
    return 1
  fi
  if [[ -n "$expect_current" ]]; then
    publish_args+=(--expect-current "$expect_current")
  fi
  if [[ -n "$PUBLICATION_ID" ]]; then
    publish_args+=(--publication-id "$PUBLICATION_ID")
  fi
  # Отметка ставится ДО переключения: receipt публикации бэкенд пишет раньше
  # смены указателя, и оборванный publish-code тоже возвращается rollback-code.
  # Отказ сервера до записи (#3307) отметку снимает, и снимает до любого выхода,
  # поэтому сигнал на время вызова отложен: rollback-code ищет receipt по sha и
  # после такого отказа вернул бы чужую активную публикацию той же ревизии.
  defer_signals
  PUBLISH_UNCONFIRMED_SHA="$BUILD_SOURCE_SHA"
  bash scripts/web-ssr-publication.sh publish-code "${publish_args[@]}" || publish_status=$?
  if [[ "$publish_status" == "$overtaken_exit" ]]; then
    PUBLISH_UNCONFIRMED_SHA=''
    refused_exit="$overtaken_exit"
    echo "❌ Выкат ${BUILD_SOURCE_SHA:0:9} остановлен на переключении: нас обогнали — сервер отказал до записи. Наш релиз не опубликован, ничего не возвращалось (код $overtaken_exit)"
  elif [[ "$publish_status" == "$not_ours_exit" ]]; then
    # #3334: эту же ревизию прямо сейчас публикует другая сессия, её публикация
    # не завершена. Для нашего выката исход тот же, что «нас обогнали».
    PUBLISH_UNCONFIRMED_SHA=''
    refused_exit="$overtaken_exit"
    echo "❌ Выкат ${BUILD_SOURCE_SHA:0:9} остановлен на переключении: эту ревизию публикует другая сессия — сервер отказал до записи. Наш релиз не опубликован, ничего не возвращалось (код $overtaken_exit)"
  elif [[ "$publish_status" == "$unsupported_exit" ]]; then
    PUBLISH_UNCONFIRMED_SHA=''
    refused_exit=1
    echo "❌ Выкат ${BUILD_SOURCE_SHA:0:9} остановлен на переключении: помощник хоста не принял --expect-current или --publication-id — отказ до записи, прод не менялся, возврат не нужен"
  fi
  resume_signals
  if [[ -n "$DEFERRED_SIGNAL" ]]; then
    exit "$DEFERRED_SIGNAL"
  fi
  if [[ -n "$refused_exit" ]]; then
    return "$refused_exit"
  fi
  if [[ "$publish_status" != "0" ]] || ! verify_deployment_runtime; then
    echo "❌ Рендер не прошёл проверку"
    rollback_unconfirmed_release || true
    return 1
  fi
  stage "выкат: финализация и диск"
  # #3272: сигнал, пришедший во время успешного finalize-code, срабатывал между
  # его завершением и снятием отметки: on_exit звал rollback-code для уже
  # принятого релиза, бэкенд отказывал, отчёт печатал «НУЖЕН РУЧНОЙ ВОЗВРАТ» при
  # целом проде. На время финализации сигнал откладывается: принятый релиз
  # сначала снимает отметку, и только потом выкат выходит с кодом сигнала.
  # Провал или обрыв самого finalize-code отметку не снимает — возврат, как раньше.
  local finalize_status=0
  defer_signals
  bash scripts/web-ssr-publication.sh finalize-code "${finalize_args[@]}" || finalize_status=$?
  if [[ "$finalize_status" == "0" ]]; then
    PUBLISH_UNCONFIRMED_SHA=''
  elif [[ "$finalize_status" == "$not_ours_exit" ]]; then
    # #3334: receipt ревизии перешёл к публикации другой сессии (наша пара была
    # вытеснена, и ревизию опубликовали заново). Отказ до записи; rollback-code
    # с нашим идентификатором получил бы тот же ответ, поэтому отметка снимается.
    PUBLISH_UNCONFIRMED_SHA=''
    finalize_status="$overtaken_exit"
    echo "❌ Выкат ${BUILD_SOURCE_SHA:0:9} не принят: публикацию этой ревизии ведёт другая сессия — сервер отказал до записи. Наш релиз не финализирован, ничего не возвращалось (код $overtaken_exit)"
  fi
  resume_signals
  if [[ -n "$DEFERRED_SIGNAL" ]]; then
    if [[ "$finalize_status" == "0" ]]; then
      echo "⚠️  Сигнал пришёл во время финализации: релиз ${BUILD_SOURCE_SHA:0:9} уже принят, прод не возвращается"
    fi
    exit "$DEFERRED_SIGNAL"
  fi
  return "$finalize_status"
}

ENV=''
ALLOW_DIRTY=0
for arg in "$@"; do
  case "$arg" in
    --allow-dirty)
      ALLOW_DIRTY=1
      ;;
    -*)
      echo "❌ Неизвестный флаг: $arg (поддерживается только --allow-dirty)"
      exit 1
      ;;
    *)
      if [[ -n "$ENV" ]]; then
        echo "❌ Лишний аргумент: $arg"
        exit 1
      fi
      ENV="$arg"
      ;;
  esac
done
ENV="${ENV:-prod}"
DEPLOY="${DEPLOY:-1}"
node -e 'require("./scripts/lib/webOutput").resolveWebOutput()'
if [[ "${EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR:-false}" == "true" ]]; then SSR_CODE_RELEASE=1; fi
if [[ "$SSR_CODE_RELEASE" == "1" && "$ENV" != "prod" ]]; then
  echo "❌ Публикация SSR-кода требует явного prod target"
  exit 1
fi
# Выкат (DEPLOY=1) — только SSR prod: сущности рендерит сервер, а статического
# пути публикации больше нет (#2766). Build-only превью (DEPLOY=0) любого
# окружения собирается как прежде.
if [[ "$DEPLOY" == "1" && "$SSR_CODE_RELEASE" != "1" ]]; then
  echo "❌ Выкат публикует только SSR-релиз prod: нужны EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR=true и server output (scripts/deploy-prod.sh выставляет их по capability бэкенда); для сборки без выката — DEPLOY=0"
  exit 1
fi
assert_deployable_source "$ENV" "$ALLOW_DIRTY" "$DEPLOY"
if [[ "$SOURCE_ALREADY_LIVE" == "1" ]]; then
  echo "🎉 Ревизия $BUILD_SOURCE_SHA уже на проде — сборка и публикация пропущены"
  exit 0
fi
open_planned_load_window

echo "🔁 Старт сборки..."
stage "зависимости"
install_deps

if [[ "$DEPLOY" == "1" ]]; then
  start_prod_media_checks
fi

stage "экспорт Metro"
build_env "$ENV"

# Целостность разбиения на чанки. Выпуск может быть «зелёным» по размеру и
# SEO и при этом падать в рантайме: shared-чанк, который приезжает как цель
# `import()`, обязан тянуть за собой соседей, чьи определения требуют его
# фабрики. Без этой проверки #1749 доехал до прода и убивал /map сообщением
# «Requiring unknown module».
stage "замыкание чанков"
echo "Проверка замыкания чанков..."
node scripts/guard-chunk-closure.js "dist/$ENV"

if [[ -n "$MEDIA_CHECKS_PID" ]]; then
  stage "медиа-проверки прода (фон, ждём конца)"
  finish_prod_media_checks
fi
stage "постобработка оболочек маршрутов"
# Тела статей, квестов, городов и стран рендерит SSR loader; здесь только
# head статических маршрутов, /article/<id>, fallback-шаблоны и chunk guard.
node scripts/postprocess-route-shells.js --dist "dist/$ENV" --api https://metravel.by

stage "проверки статики"
node scripts/guard-site-owner-name.js --dist "dist/$ENV"

stage "постобработка"
echo "Постобработка билда..."
node scripts/copy-public-files.js "dist/$ENV"
node scripts/books/copy-publication.cjs "dist/$ENV"

# Ensure required web icon URLs exist in dist even if some files are missing in public/assets/icons.
mkdir -p "dist/$ENV/assets/icons"
for icon in logo_yellow.png logo_yellow_60x60.png logo_yellow_192x192.png logo_yellow_512x512.png apple-touch-icon-180x180.png; do
  if [[ -f "assets/icons/$icon" ]]; then
    cp -f "assets/icons/$icon" "dist/$ENV/assets/icons/$icon"
  fi
done

node scripts/add-cache-bust-meta.js "dist/$ENV"

# #2762: одинаковые на всех страницах <style> (RNW, critical CSS, скелет) —
# в общие /_expo/static/css/*.css, иначе каждое поколение статики несёт
# ~250 МБ копий и пик выката упирается в бюджет. До guard'ов HTML и до
# предсжатия: новые .css получают .br.
node scripts/externalize-head-styles.js "dist/$ENV"

# #2088: add-cache-bust-meta.js carries the charset-position fix
# (scripts/lib/htmlCharset.js); guard it right after.
node scripts/guard-html-charset.js --dist "dist/$ENV"
# #2689: the same pass strips the shell default description (scripts/lib/htmlMetaDescription.js).
node scripts/guard-html-meta-description.js --dist "dist/$ENV"

node scripts/assert-deployable-source.js --copy-marker "dist/$ENV/.build-source.json"
if [[ "${METRAVEL_WEB_OUTPUT:-static}" == "server" ]]; then
  cp "dist/$ENV/.build-source.json" "$SSR_RELEASE_DIR/.build-source.json"
fi

if [[ "$ENV" == "prod" ]]; then
  echo "Проверка prod-конфига перед деплоем..."
  node scripts/verify-prod-config.js --dist "dist/$ENV"
  # Measure the finished client from this export before any server publication.
  # release:check alone did not protect ordinary deployments (#2738).
  stage "бюджет JavaScript"
  BUNDLE_BUDGET_JS_DIR="$PWD/dist/$ENV/_expo/static/js/web" \
    BUNDLE_BUDGET_HTML_DIR="$PWD/dist/$ENV" \
    node scripts/guard-bundle-budget.js --fail --report
fi

# #2484: nginx отдаёт `<file>.br` (brotli_static on) вместо сжатия на лету в q6.
# Последний писатель свежих чанков уже отработал; overlay прошлых поколений
# ниже копирует только *.js/*.css и копий не получает — их nginx сожмёт сам.
stage "предсжатие статики (brotli q11)"
node scripts/precompress-static-assets.js "dist/$ENV"

if [[ "$SSR_CODE_RELEASE" == "1" ]]; then
  # Publish the finished shell metadata, markers and precompressed assets from
  # the same export as its server. No runtime code is copied into public dist.
  rm -rf "$SSR_RELEASE_DIR/client"
  # Preserve immutable publication hardlinks inside the fresh candidate.
  rsync -aH "dist/$ENV/" "$SSR_RELEASE_DIR/client/"
fi

if [[ "$DEPLOY" == "1" ]]; then
  stage "выкат: заливка и печать релиза"
  node scripts/precompress-static-assets.js --verify "dist/$ENV"
  echo "старт деплоя ..."
  deploy_prod "$ENV"

  if [[ "$ENV" == "prod" ]]; then
    stage "пост-деплой SEO"
    echo "✅ Public readiness passed; starting post-deploy acceptance checks"
    echo "Пост-деплой проверка SEO на проде..."
    # Не валит билд (деплой уже выполнен) — только сигнализирует о замечаниях.
    # Проверки медиа прода (#1195, #1834, #1088) выкатываемый HTML не читают и
    # прошли в фоне — см. start_prod_media_checks.
    node scripts/post-deploy-seo-check.js --url https://metravel.by --limit 30 \
      || echo "⚠️  Пост-деплой SEO-проверка нашла замечания — посмотри: npm run test:seo:postdeploy:verbose"
  fi
fi

echo "🎉 Сборка завершена успешно! Собранный коммит: $BUILD_SOURCE_SHA"
