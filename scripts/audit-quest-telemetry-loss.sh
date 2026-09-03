#!/usr/bin/env bash
# Регулярная проверка «попытки ответа в квесте потерялись молча» (#1719).
#
# ЗАЧЕМ. Телеметрия попыток (#1275/#1276) — единственный источник, по которому
# видно, где игроки спотыкаются. Дыра в её доставке не видна ни одному
# пользователю и не даёт ни одной ошибки: прохождение без единой строки
# неотличимо от «игрок молчал», и разбор трения читает пустоту как факт.
# Разовый SQL из карточки #1719 нашёл 4 таких прохождения из 26 — этот скрипт
# превращает тот запрос в проверку, которую можно повторить.
#
# ЧТО СЧИТАЕТ. `lost_all` — прохождения, где БЫЛО что записать (принятый ответ
# на шаге с проверяемым типом ответа ИЛИ отказ по легаси-счётчику
# `quest_progress.attempts`), а строк в `quest_answer_attempt` нет ни своих, ни
# анонимных рядом по времени. Три невиновные группы вычтены явно:
#   - прохождения до запуска телеметрии (06.08.2026);
#   - шаги типа `any` — их телеметрия не пишет вовсе, записывать было нечего;
#   - анонимные попытки до логина (`user_id IS NULL`) — они к владельцу
#     прогресса не привязываются никогда, это ожидаемое поведение.
# Считать по колонке `progress_created_fallback` из админки без этой вычитки
# нельзя: она даёт 16 строк там, где дефектных 4.
#
# ВТОРАЯ ТАБЛИЦА — разбивка по платформам. Именно она вскрыла причину #1719:
# `QuestAnswerAttempt.PLATFORM_CHOICES` на бэкенде знает только `web` и
# `android`, поэтому КАЖДОЕ событие с iPhone сервер отвергает как 400, а клиент
# до #1719 выбрасывал такой батч молча. Ноль строк `ios` при живом
# iOS-приложении — это не «на iPhone не играют», это дыра.
#
#     bash scripts/audit-quest-telemetry-loss.sh
#     bash scripts/audit-quest-telemetry-loss.sh --since 2026-08-06 --strict
#
# npm-обёртка: `npm run quest:audit-telemetry-loss`.
#
# Запрос read-only: ни одной записи в прод-базу скрипт не делает.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./deploy-target.sh
source "${SCRIPT_DIR}/deploy-target.sh"

# Запуск телеметрии попыток на проде. Прохождения старше этой даты строк не
# имеют по определению и в знаменатель не идут.
SINCE="${QUEST_TELEMETRY_SINCE:-2026-08-06}"
DB_CONTAINER="${DB_CONTAINER:-}"
STRICT=0

log() { printf '%s\n' "$*"; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Проверка молчаливой потери попыток ответа в квестах (#1719).

  --since DATE  с какой даты считать прохождения (по умолчанию 2026-08-06,
                день запуска телеметрии попыток)
  --strict      выйти с кодом 1, если найдено хоть одно потерянное прохождение
  -h, --help    эта справка

Переменные окружения: QUEST_TELEMETRY_SINCE, DB_CONTAINER. Адрес сервера
берётся из .env.deploy (scripts/deploy-target.sh).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE="${2:?--since требует дату YYYY-MM-DD}"; shift 2 ;;
    --strict) STRICT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Неизвестный аргумент: $1 (см. --help)" ;;
  esac
done

[[ "$SINCE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "--since ожидает YYYY-MM-DD, получено: $SINCE"

require_deploy_target

# Резолв идёт после разбора аргументов: `--help` не должен оплачивать ssh.
# Имя контейнера вручную не вписывается — compose меняет разделитель при
# пересоздании (#1636).
if [[ -z "$DB_CONTAINER" ]]; then
  DB_CONTAINER="$(metravel_resolve_container_over_ssh metravel-gis)" \
    || fail "не удалось определить имя контейнера базы на проде"
fi

# SQL уходит через stdin heredoc, а не `psql -c`: вложенные кавычки внутри
# `ssh … "psql -tAc \"…\""` рвутся (docs/WORKFLOW_OPERATIONS.md §3.1).
remote_psql="docker exec -i ${DB_CONTAINER} sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA -F\"|\"'"

read -r -d '' SQL <<SQL || true
WITH base AS (
  SELECT p.id, p.quest_id, p.user_id, p.created_at, p.updated_at,
    (SELECT count(*) FROM quest_answer_attempt a
      WHERE a.quest_id = p.quest_id AND a.user_id = p.user_id) AS tele_own,
    (SELECT count(*) FROM quest_answer_attempt a
      WHERE a.quest_id = p.quest_id AND a.user_id IS NULL
        AND a.occurred_at BETWEEN p.created_at - interval '6 hours'
                              AND p.updated_at + interval '1 hour') AS tele_anon_near,
    (SELECT COALESCE(sum((v)::int), 0) FROM jsonb_each_text(p.attempts) t(k, v)
      WHERE v ~ '^[0-9]+\$') AS legacy_rej,
    (SELECT count(*) FROM jsonb_object_keys(p.answers) k
       JOIN quest_steps s ON s.quest_id = p.quest_id AND s.step_id = k
      WHERE (s.answer_pattern::jsonb->>'type') <> 'any') AS rec_ans
  FROM quest_progress p
  WHERE p.updated_at > '${SINCE}'
)
SELECT count(*),
       count(*) FILTER (WHERE rec_ans > 0 OR legacy_rej > 0),
       count(*) FILTER (WHERE (rec_ans > 0 OR legacy_rej > 0)
                          AND tele_own = 0 AND tele_anon_near = 0),
       count(*) FILTER (WHERE (rec_ans > 0 OR legacy_rej > 0)
                          AND (tele_own > 0 OR tele_anon_near > 0)),
       count(*) FILTER (WHERE rec_ans = 0 AND legacy_rej = 0)
FROM base;
SQL

read -r -d '' SQL_LOST <<SQL || true
WITH base AS (
  SELECT p.id, p.quest_id, p.user_id, p.created_at, p.updated_at,
    (SELECT count(*) FROM quest_answer_attempt a
      WHERE a.quest_id = p.quest_id AND a.user_id = p.user_id) AS tele_own,
    (SELECT count(*) FROM quest_answer_attempt a
      WHERE a.quest_id = p.quest_id AND a.user_id IS NULL
        AND a.occurred_at BETWEEN p.created_at - interval '6 hours'
                              AND p.updated_at + interval '1 hour') AS tele_anon_near,
    (SELECT COALESCE(sum((v)::int), 0) FROM jsonb_each_text(p.attempts) t(k, v)
      WHERE v ~ '^[0-9]+\$') AS legacy_rej,
    (SELECT count(*) FROM jsonb_object_keys(p.answers) k
       JOIN quest_steps s ON s.quest_id = p.quest_id AND s.step_id = k
      WHERE (s.answer_pattern::jsonb->>'type') <> 'any') AS rec_ans
  FROM quest_progress p
  WHERE p.updated_at > '${SINCE}'
)
SELECT b.id, q.quest_id, b.user_id, b.rec_ans, b.legacy_rej, b.updated_at::date
FROM base b JOIN quests_quest q ON q.id = b.quest_id
WHERE (b.rec_ans > 0 OR b.legacy_rej > 0) AND b.tele_own = 0 AND b.tele_anon_near = 0
ORDER BY b.updated_at;
SQL

read -r -d '' SQL_PLATFORM <<SQL || true
SELECT platform, count(*), min(occurred_at)::date, max(occurred_at)::date
FROM quest_answer_attempt
GROUP BY platform ORDER BY 2 DESC;
SQL

run_sql() { ssh "$PROD_SSH_TARGET" "$remote_psql" <<<"$1"; }

log "Прохождения квестов с ${SINCE} (контейнер ${DB_CONTAINER})…"
summary="$(run_sql "$SQL")" || fail "БД недоступна: ssh/docker/psql вернули ошибку"
[[ -n "$summary" ]] || fail "БД ответила пустой строкой"

IFS='|' read -r total had_something lost_all delivered nothing <<<"$summary"

log ""
log "  всего строк прогресса ....... ${total}"
log "  было что записать ........... ${had_something}"
log "  доставлено .................. ${delivered}"
log "  ПОТЕРЯНО ЦЕЛИКОМ ............ ${lost_all}"
log "  нечего записывать ........... ${nothing}"
log ""
log "Строки телеметрии по платформам:"
run_sql "$SQL_PLATFORM" | while IFS='|' read -r platform cnt first last; do
  [[ -n "$platform" ]] || continue
  log "  ${platform}: ${cnt} (${first} … ${last})"
done

if [[ "${lost_all}" -gt 0 ]]; then
  log ""
  log "Потерянные прохождения (progress_id | квест | user | принятых | отказов | дата):"
  run_sql "$SQL_LOST" | while IFS='|' read -r pid slug uid rec rej day; do
    [[ -n "$pid" ]] || continue
    log "  ${pid} | ${slug} | ${uid} | ${rec} | ${rej} | ${day}"
  done
  log ""
  log "⚠️  Дыра в доставке телеметрии. Первым делом смотреть разбивку по платформам:"
  log "    отсутствие платформы целиком означает, что сервер отвергает её как 400"
  log "    (так было с iOS до #1719 — PLATFORM_CHOICES знал только web и android)."
  # Именно `if`, а не `[[ … ]] && exit 1`: последняя команда ветки отдаёт свой
  # статус наружу, и без `--strict` штатная находка выходила бы кодом 1 —
  # обвязка прочитала бы «проверка сломалась» вместо «проверка сработала».
  if [[ "$STRICT" -eq 1 ]]; then
    exit 1
  fi
else
  log ""
  log "✅ Потерянных прохождений нет."
fi

exit 0
