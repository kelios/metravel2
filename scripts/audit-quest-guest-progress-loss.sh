#!/usr/bin/env bash
# Регулярная проверка «гостевой прогресс квеста потерялся при смене браузера» (#2739).
#
# ЗАЧЕМ. Гостевые ответы живут в хранилище одного браузера, а ссылку из письма
# подтверждения регистрации почтовое приложение открывает своим. Игрок теряет
# бесплатные точки и вводит те же ответы заново — ни ошибки, ни жалобы, только
# повтор в журнале попыток (прохождение #590: две точки введены трижды).
# Серверный перенос (#2749) должен свести этот сигнал к нулю.
#
# ЧТО СЧИТАЕТ. «Повтор» — принятый ответ на тот же `step_key` того же квеста
# из ДРУГОГО `session_key` (= другое хранилище браузера) не позже часа после
# принятого ГОСТЕВОГО ответа (`user_id IS NULL`) с той же платформы и локали.
# Совпадение платформы и локали отсекает большую часть чужих игроков на том же
# маршруте; остаток шума — две компании подряд на одном квесте (обычно один
# шаг). Сильный сигнал — повтор 2+ шагов, как в #590; список печатается для
# ручного разбора, а не только число.
#
#     bash scripts/audit-quest-guest-progress-loss.sh
#     bash scripts/audit-quest-guest-progress-loss.sh --since 2026-10-25 --strict
#
# npm-обёртка: `npm run quest:audit-guest-progress-loss`.
#
# Запрос read-only: ни одной записи в прод-базу скрипт не делает.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./deploy-target.sh
source "${SCRIPT_DIR}/deploy-target.sh"

SINCE="${QUEST_GUEST_LOSS_SINCE:-$(date -u -v-30d +%F 2>/dev/null || date -u -d '30 days ago' +%F)}"
WINDOW_MINUTES="${QUEST_GUEST_LOSS_WINDOW_MINUTES:-60}"
DB_CONTAINER="${DB_CONTAINER:-}"
STRICT=0

log() { printf '%s\n' "$*"; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Проверка потери гостевого прогресса квеста при смене браузера (#2739).

  --since DATE    с какой даты считать попытки (по умолчанию 30 дней назад)
  --window MIN    окно повтора после гостевого ответа, минут (по умолчанию 60)
  --strict        выйти с кодом 1, если найден хоть один повтор
  -h, --help      эта справка

Переменные окружения: QUEST_GUEST_LOSS_SINCE, QUEST_GUEST_LOSS_WINDOW_MINUTES,
DB_CONTAINER. Адрес сервера берётся из .env.deploy (scripts/deploy-target.sh).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE="${2:?--since требует дату YYYY-MM-DD}"; shift 2 ;;
    --window) WINDOW_MINUTES="${2:?--window требует число минут}"; shift 2 ;;
    --strict) STRICT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Неизвестный аргумент: $1 (см. --help)" ;;
  esac
done

[[ "$SINCE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "--since ожидает YYYY-MM-DD, получено: $SINCE"
[[ "$WINDOW_MINUTES" =~ ^[1-9][0-9]{0,3}$ ]] || fail "--window ожидает 1…9999 минут, получено: $WINDOW_MINUTES"

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

# Одна строка на повторную сессию: первый гостевой ответ, после которого
# другая сессия заново ответила на тот же шаг.
read -r -d '' SQL_REPLAYS <<SQL || true
WITH accepted AS (
  SELECT a.quest_id, a.step_key, a.session_key, a.user_id, a.platform, a.locale, a.occurred_at
  FROM quest_answer_attempt a
  WHERE a.verdict = 'accepted' AND a.occurred_at >= '${SINCE}'
),
replays AS (
  SELECT g.quest_id, g.session_key AS lost_session, r.session_key AS replay_session,
         r.user_id AS replay_user, g.step_key,
         EXTRACT(EPOCH FROM (r.occurred_at - g.occurred_at)) / 60 AS gap_min,
         g.occurred_at AS guest_at
  FROM accepted g
  JOIN accepted r
    ON r.quest_id = g.quest_id AND r.step_key = g.step_key
   AND r.session_key <> g.session_key
   AND r.platform = g.platform AND r.locale = g.locale
   AND r.occurred_at > g.occurred_at
   AND r.occurred_at <= g.occurred_at + interval '${WINDOW_MINUTES} minutes'
  WHERE g.user_id IS NULL
)
SELECT q.quest_id, rp.lost_session, rp.replay_session, COALESCE(rp.replay_user::text, 'гость'),
       count(DISTINCT rp.step_key), round(min(rp.gap_min))::int, min(rp.guest_at)::timestamp(0)
FROM replays rp JOIN quests_quest q ON q.id = rp.quest_id
GROUP BY q.quest_id, rp.lost_session, rp.replay_session, rp.replay_user
ORDER BY min(rp.guest_at);
SQL

run_sql() { ssh "$PROD_SSH_TARGET" "$remote_psql" <<<"$1"; }

log "Повторы гостевых ответов квестов с ${SINCE}, окно ${WINDOW_MINUTES} мин (контейнер ${DB_CONTAINER})…"
replays="$(run_sql "$SQL_REPLAYS")" || fail "БД недоступна: ssh/docker/psql вернули ошибку"

count=0
to_account=0
multi_step=0
lines=()
while IFS='|' read -r slug lost replay user steps gap at; do
  [[ -n "$slug" ]] || continue
  count=$((count + 1))
  if [[ "$user" != 'гость' ]]; then to_account=$((to_account + 1)); fi
  if [[ "$steps" -ge 2 ]]; then multi_step=$((multi_step + 1)); fi
  lines+=("  ${at} | ${slug} | ${lost:0:8} → ${replay:0:8} | ${user} | шагов ${steps} | через ${gap} мин")
done <<<"$replays"

log ""
log "  повторных сессий ............ ${count}"
log "  из них уже под аккаунтом .... ${to_account}"
log "  повторили 2+ шага ........... ${multi_step}"

if [[ "$count" -gt 0 ]]; then
  log ""
  log "Повторы (время гостевого ответа UTC | квест | сессия → повтор | кто | шагов | разрыв):"
  printf '%s\n' "${lines[@]}"
  log ""
  log "⚠️  Повтор под аккаунтом вскоре после гостевого ответа — регистрация, после которой"
  log "    гостевые точки не перенеслись (#2739/#2749). Повтор гостем — смена браузера"
  log "    до регистрации (встроенный браузер соцсети → системный)."
  # Именно `if`, а не `[[ … ]] && exit 1`: без `--strict` штатная находка не
  # должна выглядеть для обвязки как «проверка сломалась».
  if [[ "$STRICT" -eq 1 ]]; then
    exit 1
  fi
else
  log ""
  log "✅ Повторов гостевых ответов нет."
fi

exit 0
