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

on_exit() {
  local status=$?

  trap - EXIT
  # Уборка неразрывна: второй Ctrl-C, пришедший посреди `cp` в
  # restore_env_file, иначе бросил бы общий .env прод-копией — ENV_BACKUP к
  # этому моменту уже обнулён, и повторной попытки не будет.
  trap '' INT TERM HUP
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
  node "$gate_js" --env "$env_name" --allow-dirty "$allow_dirty" --deploy "$deploying" --cwd "$(pwd)" || return 1
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

install_deps() {
  if [[ "${CLEAN:-0}" == "1" ]]; then
    echo "🧹 Чищу зависимости..."
    rm -rf node_modules package-lock.json
  fi
  echo "📦 Устанавливаю зависимости..."
  yarn install --frozen-lockfile || yarn install
}

create_export_log() {
  local ENV="$1"
  mktemp -t "expo-export-${ENV}" 2>/dev/null || mktemp "/tmp/expo-export-${ENV}.XXXXXX"
}

build_env() {
  local ENV="$1"
  local DIR="dist/$ENV"
  EXPORT_LOG="$(create_export_log "$ENV")"

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env "$ENV"
  node scripts/generate-home-responsive-css.js --check

  if [[ "${METRAVEL_WEB_OUTPUT:-static}" == "server" ]]; then
    rm -rf "$DIR" "$SSR_EXPORT_DIR" "$SSR_RELEASE_DIR"
    CI=1 EXPO_NO_INTERACTIVE=1 NODE_ENV=production EXPO_ENV="$ENV" \
      EXPO_NO_METRO_LAZY=true EXPO_PUBLIC_RNW_SLIM=1 \
      EXPO_WEB_BUILD_MINIFY=true EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
      node scripts/build-web-safe.js -p web -c --output-dir "$SSR_EXPORT_DIR" 2>&1 | tee "$EXPORT_LOG"
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

  # `-c` — холодный Metro в свежем изолированном TMPDIR, и это осознанно (#2013):
  # web-сборка вшивает RU-тексты каталогов `i18n/locales` в вызывающие модули
  # (i18n/babel-inline-plugin.js), а ключ кэша Metro эти каталоги не видит —
  # тёплый кэш выкатил бы старый текст после правки одного каталога. Время
  # холодного экспорта в выкате скрыто фоновыми медиа-проверками прода.
  CI=1 \
  EXPO_NO_INTERACTIVE=1 \
  NODE_ENV=production \
  EXPO_ENV="$ENV" \
  EXPO_NO_METRO_LAZY=true \
  EXPO_PUBLIC_RNW_SLIM=1 \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    node scripts/build-web-safe.js -p web -c 2>&1 | tee "$EXPORT_LOG"

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

verify_quest_runtime() {
  local mode="${1:-strict}"
  local capability control_path
  capability="$(bash scripts/web-ssr-publication.sh capability)"
  control_path="$(node -e 'process.stdout.write(require("./scripts/lib/webOutput").getQuestControlPath(JSON.parse(process.argv[1]), {allowUnavailable: process.argv[2] === "deployment"}) || "")' "$capability" "$mode")"
  local args=(--sha "$BUILD_SOURCE_SHA" --readiness-mode "$mode")
  if [[ -n "$control_path" ]]; then args+=(--control-path "$control_path"); fi
  node scripts/verify-live-quest-ssr.js "${args[@]}"
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
  bash scripts/web-ssr-publication.sh stage "$BUILD_SOURCE_SHA" "$SSR_RELEASE_DIR"
  if ! { bash scripts/web-ssr-publication.sh publish-code "$BUILD_SOURCE_SHA" &&
         node scripts/verify-live-web-ssr.js "$BUILD_SOURCE_SHA" --readiness-mode deployment &&
         verify_quest_runtime deployment; }; then
    echo "❌ Рендер не прошёл проверку — возвращаю связанную серверную и клиентскую версию"
    bash scripts/web-ssr-publication.sh rollback-code "$BUILD_SOURCE_SHA" || echo "❌ Возврат требует восстановления владельцем"
    return 1
  fi
  bash scripts/web-ssr-publication.sh finalize-code "$BUILD_SOURCE_SHA"
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
  cp -R "dist/$ENV" "$SSR_RELEASE_DIR/client"
fi

if [[ "$DEPLOY" == "1" ]]; then
  stage "выкат (загрузка + публикация)"
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
