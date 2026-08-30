#!/usr/bin/env bash
# Быстрый бэкап production-базы metravel.by на локальную машину.
#
# Дамп снимается потоком: `pg_dump` работает внутри прод-контейнера, сжатие идёт
# уже здесь, на прод-диск ничего не пишется (на нём свободно ~2.6 ГБ, и класть
# туда 44 МиБ каждый раз незачем).
#
#     bash scripts/backup-prod-db.sh            # снять дамп
#     bash scripts/backup-prod-db.sh --check    # только проверить доступность БД
#     bash scripts/backup-prod-db.sh --out DIR --keep 10
#
# npm-обёртки: `npm run db:backup:prod`, `npm run db:backup:prod:check`.
#
# Архив лежит в `backup/` в корне репозитория, права 600, хранится только
# последний: предыдущий удаляется сразу после того, как новый прошёл проверки.
#
# Внутри дампа персональные данные пользователей, а репозиторий публичный,
# поэтому `backup/` закрыт в `.gitignore`, и скрипт отказывается писать в
# каталог, который git не игнорирует.
#
# Документация: docs/DB_BACKUP.md

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=./deploy-target.sh
source "${SCRIPT_DIR}/deploy-target.sh"

# Пустое значение = резолвить на проде. Имя вписывать вручную нельзя: compose
# меняет разделитель при пересоздании, и на хосте сейчас живут обе схемы сразу
# (app/nginx уже переезжали, базу пока не трогали). Резолв — общая функция из
# scripts/deploy-target.sh, регулярка существует только там (#1636, борд #733).
# DB_CONTAINER=… по-прежнему перекрывает резолв для разового прогона.
DB_CONTAINER="${DB_CONTAINER:-}"
BACKUP_DIR="${DB_BACKUP_DIR:-${REPO_ROOT}/backup}"
KEEP="${DB_BACKUP_KEEP:-1}"
MIN_BYTES="${DB_BACKUP_MIN_BYTES:-1048576}"
CHECK_ONLY=0

log() { printf '%s\n' "$*"; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Бэкап production-базы metravel.by на локальный диск.

  --out DIR     куда положить архив (по умолчанию backup/ в корне репозитория)
  --keep N      сколько последних архивов оставить (по умолчанию 1: старый
                удаляется сразу после того, как новый прошёл проверки)
  --check       не качать дамп: только проверить, что БД на проде отвечает
  -h, --help    эта справка

Каталог с дампами обязан быть в .gitignore — иначе скрипт откажется писать.

Переменные окружения: DB_BACKUP_DIR, DB_BACKUP_KEEP, DB_CONTAINER,
DB_BACKUP_MIN_BYTES. Адрес сервера берётся из .env.deploy (scripts/deploy-target.sh).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) BACKUP_DIR="${2:?--out требует путь}"; shift 2 ;;
    --keep) KEEP="${2:?--keep требует число}"; shift 2 ;;
    --check) CHECK_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Неизвестный аргумент: $1 (см. --help)" ;;
  esac
done

[[ "$KEEP" =~ ^[0-9]+$ ]] || fail "--keep ожидает целое число, получено: $KEEP"

require_deploy_target

# Резолв идёт ПОСЛЕ разбора аргументов и require_deploy_target: `--help` не
# должен оплачивать ssh, а неверный флаг обязан падать своим сообщением.
if [[ -z "$DB_CONTAINER" ]]; then
  DB_CONTAINER="$(metravel_resolve_container_over_ssh metravel-gis)" \
    || fail "не удалось определить имя контейнера базы на проде"
fi

# Одинарные кавычки внутри доходят до удалённого `sh -c`, поэтому $POSTGRES_USER
# и $POSTGRES_DB раскрываются уже внутри контейнера. Пароль не нужен: в
# контейнерном pg_hba.conf локальные подключения идут через trust.
remote_dump="docker exec -i ${DB_CONTAINER} sh -c 'pg_dump --no-owner --no-acl -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"'"
remote_probe="docker exec -i ${DB_CONTAINER} sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"select current_database() || chr(32) || pg_size_pretty(pg_database_size(current_database()))\"'"

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  # Адрес прод-сервера в вывод не печатаем: репозиторий публичный, и именно
  # поэтому реквизиты живут только в gitignored .env.deploy.
  log "Проверяю базу на проде (контейнер ${DB_CONTAINER})…"
  probe="$(ssh "$PROD_SSH_TARGET" "$remote_probe")" \
    || fail "БД недоступна: ssh/docker/psql вернули ошибку"
  [[ -n "$probe" ]] || fail "БД ответила пустой строкой — контейнер жив, но база не отвечает"
  log "✅ База отвечает: ${probe}"
  exit 0
fi

mkdir -p "$BACKUP_DIR"

# Дамп с персональными данными в публичном репозитории — самый дорогой способ
# ошибиться, а в этом checkout ещё и работает сторонний авто-коммит, который
# забирает всё дерево. Поэтому пишем только туда, что git заведомо игнорирует.
if git -C "$BACKUP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git -C "$BACKUP_DIR" check-ignore -q "$BACKUP_DIR"; then
    fail "Каталог ${BACKUP_DIR} внутри git-репозитория и НЕ покрыт .gitignore.
   Дамп содержит персональные данные пользователей, а репозиторий публичный.
   Добавь путь в .gitignore или укажи другой каталог через --out."
  fi
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${BACKUP_DIR}/metravel-postgres-${timestamp}.sql.gz"
partial="${archive}.part"

cleanup_partial() { [[ -f "$partial" ]] && rm -f "$partial"; }
trap cleanup_partial EXIT

log "Снимаю дамп с прода (контейнер ${DB_CONTAINER})…"
started="$(date +%s)"

# Права ставим до записи: архив с персональными данными не должен ни секунды
# лежать с правами по умолчанию.
umask 077

set +e
ssh "$PROD_SSH_TARGET" "$remote_dump" | gzip -9 > "$partial"
pipe_status=("${PIPESTATUS[@]}")
set -e

# Без этой проверки упавший ssh оставил бы валидный, но пустой .gz — то есть
# «успешный» бэкап без данных.
[[ "${pipe_status[0]}" -eq 0 ]] || fail "ssh/pg_dump завершились с кодом ${pipe_status[0]} — дамп не снят"
[[ "${pipe_status[1]}" -eq 0 ]] || fail "gzip завершился с кодом ${pipe_status[1]}"

size="$(wc -c < "$partial" | tr -d ' ')"
[[ "$size" -ge "$MIN_BYTES" ]] \
  || fail "Архив подозрительно мал: ${size} байт (минимум ${MIN_BYTES}) — вероятно, дамп оборвался"

# Один проход распаковки проверяет сразу и целостность gzip, и то, что pg_dump
# дошёл до конца: маркер завершения пишется последней строкой.
set +e
tail_lines="$(gzip -cd "$partial" | tail -3)"
verify_status=("${PIPESTATUS[@]}")
set -e

[[ "${verify_status[0]}" -eq 0 ]] || fail "Архив повреждён: gzip -cd вернул ${verify_status[0]}"
grep -q 'PostgreSQL database dump complete' <<<"$tail_lines" \
  || fail "В архиве нет маркера завершения pg_dump — дамп неполный, файл не сохранён"

mv "$partial" "$archive"
trap - EXIT

finished="$(date +%s)"
human_size="$(du -h "$archive" | cut -f1 | tr -d ' ')"
log "✅ Готово: ${archive}"
log "   размер ${human_size} (${size} байт), время $((finished - started)) с, целостность проверена"

# `mapfile` здесь недоступен: системный bash на macOS — 3.2, поэтому читаем
# список циклом.
if [[ "$KEEP" -gt 0 ]]; then
  while IFS= read -r old; do
    [[ -n "$old" ]] || continue
    rm -f "$old"
    log "   удалён старый архив: $(basename "$old")"
  done < <(ls -1t "${BACKUP_DIR}"/metravel-postgres-*.sql.gz 2>/dev/null | tail -n "+$((KEEP + 1))")
fi

log "Проверить архив вручную: gzip -t \"${archive}\""
