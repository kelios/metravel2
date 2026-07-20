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

  echo "📦 Применяю .env.$ENV → .env"
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
  local EXPORT_LOG
  EXPORT_LOG="$(create_export_log "$ENV")"
  trap 'rm -f "${EXPORT_LOG:-}"' EXIT

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env "$ENV"

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

deploy_prod() {
  local ENV="$1"
  rsync -avzhe "ssh" --delete \
    ./dist/ \
    "sx3@178.172.137.129:/home/sx3/metravel/dist/"

  ssh sx3@178.172.137.129 "set -e
    cd /home/sx3/metravel
    mkdir -p static
    # static/ is bind-mounted into the app container at /app/static. Swap dirs
    # (dist.new/dist.old) get created by the container user (uid 1984) or an
    # out-of-band op, so they end up owned by a uid the host user (sx3) cannot
    # unlink — a plain host 'rm -rf' silently fails and stale dist.old(.stale-*)
    # dirs pile up (past manual-recovery need). Route every destructive removal
    # through root inside the container; mv/rename still works on the host
    # (write on static/ is enough for a rename within it).
    app_ctr=\$(docker ps --format '{{.Names}}' | grep -E '^metravel[-_]app[-_]1\$' | head -1)
    if [ -z \"\$app_ctr\" ]; then
      echo \"⚠️ app container not found; stale-dir cleanup falls back to host rm (may lack permissions)\"
    fi
    rroot() { # rm -rf the given paths as root in the container; never abort
      if [ -n \"\$app_ctr\" ]; then
        docker exec -u 0 \"\$app_ctr\" sh -c \"rm -rf \$1\" || true
      else
        rm -rf \$1 2>/dev/null || true
      fi
    }

    # Purge leftovers from a prior interrupted/manual deploy before the swap.
    rroot '/app/static/dist.new /app/static/dist.old /app/static/dist.old-* /app/static/dist.old.stale-*'

    # Nginx serves /static/* from the shared static root, while the web export
    # lives one level deeper in static/dist. Publish the canonical quest
    # fallback at its backend-owned URL before swapping the web build.
    quest_cover_repo_path=static/quests/quest-default-cover.svg
    quest_cover_source=dist/$ENV/static/quests/quest-default-cover.svg
    quest_cover_dir=static/quests
    quest_cover_target=static/quests/quest-default-cover.svg
    if git ls-files --error-unmatch -- "\$quest_cover_repo_path" >/dev/null 2>&1; then
      echo "❌ Refusing to overwrite Git-tracked path: \$quest_cover_repo_path"
      exit 1
    fi
    if [ ! -s "\$quest_cover_source" ]; then
      echo "❌ Quest fallback cover is missing or empty: \$quest_cover_source"
      exit 1
    fi
    if [ -L "\$quest_cover_dir" ] || [ -L "\$quest_cover_target" ]; then
      echo "❌ Refusing to publish the quest fallback through a symlink"
      exit 1
    fi
    if [ -e "\$quest_cover_target" ] && [ ! -f "\$quest_cover_target" ]; then
      echo "❌ Refusing to replace a non-file quest fallback target"
      exit 1
    fi
    mkdir -p "\$quest_cover_dir"
    quest_cover_tmp=\$(mktemp "\$quest_cover_dir/.quest-default-cover.svg.XXXXXX")
    cp "\$quest_cover_source" "\$quest_cover_tmp"
    mv -f "\$quest_cover_tmp" "\$quest_cover_target"
    if ! cmp -s "\$quest_cover_source" "\$quest_cover_target"; then
      echo "❌ Published quest fallback does not match the deploy artifact"
      exit 1
    fi

    mv dist/$ENV static/dist.new

    rollback_dir=static/dist.old
    if [ -d static/dist ]; then
      mv static/dist \"\$rollback_dir\"
    fi
    # Keep previous hashed Expo static assets for a short overlap window.
    # This prevents "Requiring unknown module" crashes for active browser tabs
    # that still execute older runtime chunks during a fresh deploy.
    if [ -d \"\$rollback_dir/_expo/static\" ]; then
      mkdir -p static/dist.new/_expo/static
      # IMPORTANT: never overwrite new build artifacts with old ones.
      # We only backfill files that are missing in the new build so existing
      # tabs can finish loading legacy chunks while fresh navigations keep
      # using the current release.
      rsync -a --ignore-existing \"\$rollback_dir/_expo/static/\" static/dist.new/_expo/static/
    fi
    # HTML shell still switches atomically to the new build below.
    mv static/dist.new static/dist
    # Drop the rollback copy as root (may be owned by another uid).
    rroot '/app/static/dist.old'
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
      docker compose -f docker-compose-prod.app.yaml restart app nginx
    else
      docker-compose -f docker-compose-prod.app.yaml restart nginx
    fi
    rm -rf dist
  "

  rm -rf dist
}

ENV="${1:-prod}"
DEPLOY="${DEPLOY:-1}"

echo "🔁 Старт сборки..."
install_deps

build_env "$ENV"

echo "Генерация SEO-страниц..."
node scripts/generate-seo-pages.js --dist "dist/$ENV" --api https://metravel.by

# FE-IDX-1: убедиться, что тело статьи реально инжектировано в статику.
# Без этого Googlebot видит пустой скелетон → "просканирована, но не проиндексирована".
echo "Проверка: тело статей в статике (FE-IDX-1)..."
BODY_PAGES=$( { grep -rl "ssg-travel-article" "dist/$ENV/travels" 2>/dev/null || true; } | wc -l | tr -d ' ')
if [[ "${BODY_PAGES:-0}" -lt 1 ]]; then
  echo "❌ Ни одна travel-страница не содержит тело статьи (ssg-travel-article) — FE-IDX-1 сломан, прерываю деплой."
  exit 1
fi
echo "✅ Тело статьи инжектировано в $BODY_PAGES travel-страниц"

# Инвариант: ровно один <h1> на travel-странице (пост-деплой проверка это требует).
echo "Проверка: ровно один <h1> на travel-страницу (выборка)..."
# mapfile отсутствует в bash 3.2 (macOS) — наполняем массив через while-read + process substitution.
H1_SAMPLE=()
while IFS= read -r _h1_line; do
  H1_SAMPLE+=("$_h1_line")
done < <(find "dist/$ENV/travels" -name "index.html" 2>/dev/null | head -20)
BAD_H1=0
for f in "${H1_SAMPLE[@]:-}"; do
  [[ -f "$f" ]] || continue
  n=$( { grep -o "<h1[ >]" "$f" 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [[ "$n" != "1" ]]; then echo "  ✗ $f: <h1> = $n"; BAD_H1=1; fi
done
if [[ "$BAD_H1" == "1" ]]; then
  echo "❌ Нарушен инвариант: на travel-странице должен быть ровно один <h1>. Прерываю деплой."
  exit 1
fi
echo "✅ Ровно один <h1> на странице"

echo "Проверка SEO-артефактов..."
node scripts/verify-static-travel-seo.js --dist "dist/$ENV" --api https://metravel.by

echo "Постобработка билда..."
node scripts/copy-public-files.js "dist/$ENV"

# Ensure required web icon URLs exist in dist even if some files are missing in public/assets/icons.
mkdir -p "dist/$ENV/assets/icons"
for icon in logo_yellow.png logo_yellow_60x60.png logo_yellow_192x192.png logo_yellow_512x512.png apple-touch-icon-180x180.png; do
  if [[ -f "assets/icons/$icon" ]]; then
    cp -f "assets/icons/$icon" "dist/$ENV/assets/icons/$icon"
  fi
done

node scripts/add-cache-bust-meta.js "dist/$ENV"

if [[ "$DEPLOY" == "1" ]]; then
  echo "старт деплоя ..."
  deploy_prod "$ENV"

  if [[ "$ENV" == "prod" ]]; then
    echo "⏳ Жду перезапуск app/nginx..."
    sleep 8
    echo "Пост-деплой проверка SEO на проде..."
    # Не валит билд (деплой уже выполнен) — только сигнализирует о замечаниях.
    node scripts/post-deploy-seo-check.js --url https://metravel.by --limit 30 \
      || echo "⚠️  Пост-деплой SEO-проверка нашла замечания — посмотри: npm run test:seo:postdeploy:verbose"
  fi
fi

echo "🎉 Сборка завершена успешно!"
