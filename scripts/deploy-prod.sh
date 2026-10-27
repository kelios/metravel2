#!/bin/bash
# Штатный прод-выкат web-фронтенда одной командой (#2013).
#
# Рецепт изолированного worktree (docs/WORKFLOW_OPERATIONS.md §3.5) агент
# выполнял по шагам — проверка процессов и лока, fetch, worktree, симлинки,
# сборка, сверка прода, уборка, — и каждый шаг был отдельным ходом LLM: около
# шести минут до старта сборки из ~15 минут выката #2008. Здесь те же шаги
# идут детерминированно.
#
#   scripts/deploy-prod.sh [<commit>]   выкат коммита (по умолчанию origin/main)
#   DEPLOY=0 scripts/deploy-prod.sh     build-only прогон в том же worktree
#   DEPLOY_QUIET=1 …                    в консоль — только этапы, итоги и ошибки;
#                                       полный лог всегда в .codex-temp/deploy/
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Основной чекаут, даже если скрипт позвали из worktree: общий `.git` у них один.
MT="$(cd "$SCRIPT_DIR" && cd "$(git rev-parse --git-common-dir)/.." && pwd -P)"

# Лок сборки держится на весь выкат, от fetch до уборки worktree. Путь лока
# общий для всех worktree (scripts/build-lock.js), поэтому второй выкат из
# любой сессии упрётся в него сразу, а вложенный build-prod.sh унаследует
# MT_BUILD_LOCK_OWNED=1 и брать лок повторно не станет.
if [[ "${MT_BUILD_LOCK_OWNED:-0}" != "1" ]]; then
  exec node "$MT/scripts/run-with-build-lock.js" -- "$0" "$@"
fi

TARGET="${1:-origin/main}"
DEPLOY="${DEPLOY:-1}"
# Since 17.10.2026 the production static root is a managed v1 pointer (#2363)
# and legacy publication refuses it: the ordinary deploy publishes the
# translated package within the owner-selected physical budget. An explicit
# operator value (for example ru-only owner maintenance) still wins. DEPLOY=0
# takes the same v1 path: asset capture and inventory read prod over SSH and
# need a clean prod checkout; the SSH-free preview is `DEPLOY=0 ./build-prod.sh prod`.
export QUEST_SEO_MODE="${QUEST_SEO_MODE:-translations}"
export QUEST_SEO_MANAGED_MAX_BYTES="${QUEST_SEO_MANAGED_MAX_BYTES:-1610612736}"
# Фиксированный путь: worktree, брошенный прерванным выкатом, находится и
# снимается следующим, а не копится рядом под новым именем.
WT="$(dirname "$MT")/worktrees/deploy-prod"
LOG_DIR="$MT/.codex-temp/deploy"
# Строки сводки этапов build-prod.sh (`   65 с  экспорт Metro`) начинаются с
# пробелов — без своей ветки тихий режим оставил бы от таблицы один заголовок.
QUIET_PATTERN='^(▶|⏱|🎉|❌|⚠️|✅|📊|🔖)|^ +[0-9]+ с  |Error|ERROR|^(Number of regular files transferred|Total transferred file size|Literal data|Matched data):'
LOG=''
STARTED_AT=$SECONDS

remove_worktree() {
  local link
  for link in node_modules .env.prod .env.deploy; do
    if [[ -L "$WT/$link" ]]; then
      rm -f "$WT/$link"
    fi
  done
  if [[ -e "$WT" ]]; then
    git -C "$MT" worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"
  fi
  git -C "$MT" worktree prune
}

# Выкат пишет в прод-чекаут бэкенда (staging `dist/`, `static/`), а его
# Git-tracked пути неизменяемы: любое чужое отклонение — стоп до сборки и задача
# area=back (docs/RULES.md). Штатно там лежат только дамп и сертификаты nginx;
# `dist/` — собственный staging прерванного выката, его перезальёт rsync.
check_prod_checkout_clean() {
  local status_lines line path unexpected=''
  # shellcheck source=scripts/deploy-target.sh
  source "$WT/scripts/deploy-target.sh"
  require_deploy_target >/dev/null
  status_lines="$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$PROD_SSH_TARGET" \
    "cd '$PROD_REMOTE_DIR' && git status --porcelain 2>/dev/null")"
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    path="${line:3}"
    case "$path" in
      dump.sql | deploy/prod/nginx/ssl/* | dist/ | dist/*) ;;
      *) unexpected+="   $line"$'\n' ;;
    esac
  done <<<"$status_lines"
  if [[ -n "$unexpected" ]]; then
    echo "❌ Прод-чекаут бэкенда грязный — выкат остановлен до сборки, нужна задача area=back:"
    printf '%s' "$unexpected"
    return 1
  fi
  echo "✅ Прод-чекаут бэкенда чистый"
}

on_exit() {
  local status=$?
  trap - EXIT
  trap '' INT TERM HUP
  remove_worktree || true
  echo "⏱  Выкат целиком: $((SECONDS - STARTED_AT)) с${LOG:+ (полный лог: ${LOG#"$MT/"})}"
  exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

git -C "$MT" fetch --quiet origin main
SHA="$(git -C "$MT" rev-parse --verify "${TARGET}^{commit}")"
SHORT="${SHA:0:9}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/prod-$SHORT-$(date -u +%Y%m%dT%H%M%SZ).log"
export QUEST_SEO_STATE_PATH="$LOG.quest-seo.json"

# Лок у нас, значит оставшийся worktree — след прерванного выката.
remove_worktree
mkdir -p "$(dirname "$WT")"
git -C "$MT" worktree add --detach --quiet "$WT" "$SHA"
# node_modules общий со всеми worktree репозитория; .env.* в git не лежат, а без
# них apply_env и адрес прод-хоста не найдутся. Симлинк, а не копия: секреты не
# размножаются по дереву.
ln -sfn "$MT/node_modules" "$WT/node_modules"
for env_file in .env.prod .env.deploy; do
  ln -sfn "$MT/$env_file" "$WT/$env_file"
done

echo "🚀 Прод-выкат $SHORT из ${WT} (DEPLOY=$DEPLOY)"
if [[ "$DEPLOY" == "1" ]]; then
  check_prod_checkout_clean
  # The committed rollout switch (WEB_SSR_ROLLOUT_ENABLED in webOutput.js) and
  # the installed backend capability together select the runtime model. A
  # broken/malformed installed helper must fail closed, never downgrade a live
  # SSR release to an ordinary static build.
  SSR_CAPABILITY="$(bash "$WT/scripts/web-ssr-publication.sh" capability)"
  WEB_OUTPUT="$(node -e 'const {resolveDeployWebOutput}=require(process.argv[1]); process.stdout.write(resolveDeployWebOutput(JSON.parse(process.argv[2])).output)' "$WT/scripts/lib/webOutput.js" "$SSR_CAPABILITY")"
  QUEST_WEB_RUNTIME="$(node -e 'const {resolveDeployWebOutput}=require(process.argv[1]); process.stdout.write(String(resolveDeployWebOutput(JSON.parse(process.argv[2])).questRuntime))' "$WT/scripts/lib/webOutput.js" "$SSR_CAPABILITY")"
  export EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR="$QUEST_WEB_RUNTIME"
  if [[ "$WEB_OUTPUT" == server ]]; then
    export METRAVEL_WEB_OUTPUT=server EXPO_PUBLIC_WEB_RUNTIME_SSR=true
    echo '✅ Backend SSR готов: один серверный экспорт и связанная публикация'
  else
    export METRAVEL_WEB_OUTPUT=static EXPO_PUBLIC_WEB_RUNTIME_SSR=false
  fi
fi
set +e
if [[ "${DEPLOY_QUIET:-0}" == "1" ]]; then
  (cd "$WT" && DEPLOY="$DEPLOY" ./build-prod.sh prod) 2>&1 | tee "$LOG" | grep --line-buffered -E "$QUIET_PATTERN"
  status=${PIPESTATUS[0]}
else
  (cd "$WT" && DEPLOY="$DEPLOY" ./build-prod.sh prod) 2>&1 | tee "$LOG"
  status=${PIPESTATUS[0]}
fi
set -e

if [[ "$status" != "0" && "${DEPLOY_QUIET:-0}" == "1" ]]; then
  echo "❌ build-prod.sh завершился с кодом $status — хвост лога:"
  tail -n 40 "$LOG"
fi

if [[ "$status" == "0" && "$DEPLOY" == "1" ]]; then
  # Ограниченный повтор и раздельный диагноз «не опубликован» / «хост не
  # ответил» — scripts/verify-live-release.sh (#2448).
  bash "$SCRIPT_DIR/verify-live-release.sh" "$SHA" || status=1
fi

exit "$status"
