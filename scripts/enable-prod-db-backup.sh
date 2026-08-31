#!/bin/bash
# Включение и приёмка ежедневного бэкапа production-базы в S3 (борд #1247).
#
#     bash scripts/enable-prod-db-backup.sh            # установить/обновить расписание
#     bash scripts/enable-prod-db-backup.sh --run-now  # прогнать бэкап прямо сейчас
#     bash scripts/enable-prod-db-backup.sh --verify   # проверить критерии приёмки
#
# Что делает установка на прод-хосте (всё от пользователя `sx3`, без sudo):
#
#   ~/.metravel-backup.env          конфиг (0600): S3_URI, BACKUP_DIR, RETENTION_DAYS, AWS_CLI
#   ~/.local/bin/metravel-db-backup обёртка (0700): резолвит контейнер БД, лочит, пишет лог
#   ~/logs/metravel-db-backup.log   лог (0640)
#   user crontab                    строка расписания с маркером `# metravel-db-backup`
#
# Почему не `/etc/cron.d` + `/etc/metravel-backup.env`, как в карточке #1247:
# у `sx3` sudo только по паролю, root-шаги агент выполнить не может. Плюс сама
# исходная схема нерабочая: задача запускается ОТ `sx3`, а файл `0600 root` он
# не прочитает — `source` в cron-строке упал бы. Вариант «поднять в root»
# описан в docs/DB_BACKUP.md, поведение от этого не меняется.
#
# Сам скрипт бэкапа НЕ дублируется: запускается канонический
# `deploy/prod/backup/backup_database_to_s3.sh` из бэкенд-чекаута на проде.
#
# Документация: docs/DB_BACKUP.md

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./deploy-target.sh
source "${SCRIPT_DIR}/deploy-target.sh"

S3_URI="${S3_URI:-s3://metravel-backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-5}"
CRON_SCHEDULE="${CRON_SCHEDULE:-15 2 * * *}"   # время хоста: Europe/Minsk
MODE="install"

usage() {
  cat <<'USAGE'
Включение ежедневного бэкапа прод-базы в S3.

  (без аргументов)  установить конфиг, обёртку, лог и cron-строку (идемпотентно)
  --run-now         прогнать полный бэкап немедленно и показать результат
  --verify          проверить критерии приёмки #1247, ничего не меняя
  -h, --help        эта справка

Переменные окружения: S3_URI, RETENTION_DAYS, CRON_SCHEDULE.
Адрес сервера — из .env.deploy (scripts/deploy-target.sh).
USAGE
}

case "${1:-}" in
  "") ;;
  --run-now) MODE="run-now" ;;
  --verify) MODE="verify" ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; echo "❌ неизвестный аргумент: $1" >&2; exit 2 ;;
esac

require_deploy_target

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

# Регулярка имени контейнера существует ровно в одном месте — забираем её из
# deploy-target.sh, а не переписываем (борд #733, #1636).
{
  # Константы кладём телом payload, а не аргументами ssh: удалённый шелл
  # переразбирает командную строку, и `15 2 * * *` там расщепляется по пробелам,
  # а `*` ещё и раскрывается глобом по $HOME — MODE приезжал пустым, скрипт
  # молча выходил с 0.
  printf 'S3_URI=%q\nRETENTION_DAYS=%q\nCRON_SCHEDULE=%q\nMODE=%q\n' \
    "$S3_URI" "$RETENTION_DAYS" "$CRON_SCHEDULE" "$MODE"
  printf 'MTV_SNIPPET=$(cat <<%sMTV_SNIPPET_EOF%s\n' "'" "'"
  metravel_container_remote_snippet
  printf 'MTV_SNIPPET_EOF\n)\n'
  cat <<'REMOTE_MAIN'
set -Eeuo pipefail

ENV_FILE="$HOME/.metravel-backup.env"
WRAPPER="$HOME/.local/bin/metravel-db-backup"
LOG_FILE="$HOME/logs/metravel-db-backup.log"
BACKUP_DIR="$HOME/metravel/deploy/prod/backups"
CANONICAL="$HOME/metravel/deploy/prod/backup/backup_database_to_s3.sh"
AWS_CLI="$HOME/.local/bin/aws"
CRON_MARK="# metravel-db-backup"

fail() { echo "❌ $*" >&2; exit 1; }

install_all() {
  echo "== преднастройка =="
  [[ -x "$CANONICAL" ]] || fail "нет канонического скрипта: $CANONICAL"
  [[ -x "$AWS_CLI" ]] || fail "нет AWS CLI: $AWS_CLI"
  docker ps >/dev/null 2>&1 </dev/null || fail "docker недоступен пользователю $(id -un)"
  echo "скрипт: $(md5sum "$CANONICAL" | cut -c1-12)…  aws: $("$AWS_CLI" --version 2>&1)"

  umask 077
  mkdir -p "$(dirname "$WRAPPER")" "$(dirname "$LOG_FILE")" "$BACKUP_DIR"

  cat > "$ENV_FILE" <<ENVEOF
# Конфиг ежедневного бэкапа прод-базы (борд #1247).
# Создан scripts/enable-prod-db-backup.sh — правки руками перетрутся.
# Секретов здесь нет: ключ S3 лежит в ~/.aws/credentials (0600).
S3_URI=$S3_URI
BACKUP_DIR=$BACKUP_DIR
RETENTION_DAYS=$RETENTION_DAYS
AWS_CLI=$AWS_CLI
LOG_FILE=$LOG_FILE
ENVEOF
  chmod 600 "$ENV_FILE"

  {
    echo '#!/bin/bash'
    echo '# Обёртка ежедневного бэкапа прод-базы (борд #1247).'
    echo '# СГЕНЕРИРОВАНА scripts/enable-prod-db-backup.sh — не править руками.'
    echo 'set -Eeuo pipefail'
    printf '%s\n' "$MTV_SNIPPET"
    cat <<'WRAPEOF'
set -a
# shellcheck disable=SC1091
. "$HOME/.metravel-backup.env"
set +a

mkdir -p "$(dirname "$LOG_FILE")"
exec >>"$LOG_FILE" 2>&1

if ! DB_CONTAINER="$(metravel_resolve_container metravel-gis)"; then
  printf '[%s] ERROR: контейнер БД не найден, бэкап не запускался\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi
export DB_CONTAINER

cd "$HOME/metravel"

# `aws s3 cp` печатает прогресс-бар и без TTY: в лог уезжали 50+ строк
# `Completed N MiB/…`, склеенных \r в одну. Режем их, но код возврата берём от
# самого бэкапа (`pipefail` + awk, который всегда выходит с 0).
flock -n "$HOME/.metravel-backup.lock" \
  ./deploy/prod/backup/backup_database_to_s3.sh "$@" 2>&1 \
  | tr '\r' '\n' \
  | awk 'NF && !/^Completed /'
WRAPEOF
  } > "$WRAPPER"
  chmod 700 "$WRAPPER"

  touch "$LOG_FILE"
  chmod 640 "$LOG_FILE"

  local tmp
  tmp="$(mktemp)"
  crontab -l 2>/dev/null | grep -v -F "$CRON_MARK" > "$tmp" || true
  echo "$CRON_SCHEDULE $WRAPPER $CRON_MARK" >> "$tmp"
  crontab "$tmp"
  rm -f "$tmp"

  echo "== установлено =="
  ls -l "$ENV_FILE" "$WRAPPER" "$LOG_FILE"
  crontab -l | grep -F "$CRON_MARK"
  echo "расписание в таймзоне хоста: $(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone)"
}

run_now() {
  echo "== разовый прогон (полный цикл с выгрузкой в S3) =="
  local rc=0
  "$WRAPPER" || rc=$?
  echo "exit=$rc"
  tail -6 "$LOG_FILE"
  return "$rc"
}

verify() {
  local rc=0
  # shellcheck disable=SC1090
  [[ -r "$ENV_FILE" ]] && { set -a; . "$ENV_FILE"; set +a; }

  echo "== 1. расписание =="
  if crontab -l 2>/dev/null | grep -F "$CRON_MARK"; then :; else echo "❌ cron-строки нет"; rc=1; fi

  echo "== 2. лог =="
  if [[ -f "$LOG_FILE" ]]; then
    ls -l "$LOG_FILE"
    local ok_dates
    ok_dates="$(grep -F 'Backup completed' "$LOG_FILE" 2>/dev/null | sed -n 's/^\[\([0-9-]\{10\}\).*/\1/p' | sort -u)"
    local nights
    nights="$(printf '%s\n' "$ok_dates" | grep -c . || true)"
    echo "успешных ночей (уникальных дат с 'Backup completed'): $nights"
    printf '%s\n' "$ok_dates" | sed 's/^/  /'
    grep -c 'ERROR' "$LOG_FILE" >/dev/null 2>&1 && echo "строк с ERROR: $(grep -c 'ERROR' "$LOG_FILE")"
    tail -4 "$LOG_FILE" | sed 's/^/  /'
    [[ "$nights" -ge 2 ]] || { echo "⏳ по DoD нужно ≥2 суток подряд"; rc=1; }
  else
    echo "❌ лога нет: $LOG_FILE"; rc=1
  fi

  echo "== 3. локальный архив =="
  local newest
  newest="$(ls -1t "${BACKUP_DIR}"/metravel-postgres-*.sql.gz 2>/dev/null | head -1 || true)"
  if [[ -n "$newest" ]]; then
    ls -l "$newest"
    if gzip -t "$newest"; then echo "gzip -t: OK"; else echo "❌ gzip -t провален"; rc=1; fi
    local head_line
    # head закрывает пайп раньше gzip: без `|| true` pipefail отдаёт 141 (SIGPIPE)
    # и `set -e` роняет приёмку прямо посреди проверок.
    head_line="$(gzip -cd "$newest" 2>/dev/null | head -2 | tr '\n' ' ' || true)"
    echo "первые строки дампа: ${head_line}"
    case "$head_line" in
      *"PostgreSQL database dump"*) echo "заголовок дампа: OK" ;;
      *) echo "❌ это не заголовок дампа PostgreSQL"; rc=1 ;;
    esac
  else
    echo "❌ локальных архивов нет в $BACKUP_DIR"; rc=1
  fi

  echo "== 4. объект в S3 =="
  if [[ -x "$AWS_CLI" && -n "${S3_URI:-}" ]]; then
    if "$AWS_CLI" s3 ls "${S3_URI%/}/" | tail -5; then
      local s3_size local_size
      s3_size="$("$AWS_CLI" s3 ls "${S3_URI%/}/" | sort -k1,2 | tail -1 | awk '{print $3}')"
      local_size="$(wc -c < "$newest" 2>/dev/null | tr -d ' ')"
      echo "размер: S3=${s3_size:-?} локально=${local_size:-?}"
      if [[ -n "$s3_size" && "$s3_size" == "$local_size" ]]; then
        echo "совпадение размеров: OK"
      else
        echo "⚠️ размеры не совпали (свежий локальный архив мог ещё не уехать)"
      fi
    else
      echo "❌ листинг S3 не удался"; rc=1
    fi
  else
    echo "❌ нет AWS CLI или S3_URI"; rc=1
  fi

  echo
  if [[ "$rc" -eq 0 ]]; then echo "✅ критерии приёмки #1247 выполнены"; else echo "⚠️ приёмка ещё не закрыта (см. отметки выше)"; fi
  return "$rc"
}

case "$MODE" in
  install) install_all ;;
  run-now) run_now ;;
  verify) verify ;;
esac
REMOTE_MAIN
} > "$payload"

ssh -o ConnectTimeout=20 -o BatchMode=yes "$PROD_SSH_TARGET" bash -s < "$payload"
