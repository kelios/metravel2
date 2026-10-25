#!/bin/bash
# Установка и приёмка ежедневного security-отчёта прод-хоста (борд #2721).
#
#     bash scripts/enable-prod-security-report.sh            # установить/обновить скрипт, конфиг и cron
#     bash scripts/enable-prod-security-report.sh --preview  # собрать отчёт сейчас и показать, не отправляя
#     bash scripts/enable-prod-security-report.sh --run-now  # собрать и отправить письмо прямо сейчас
#     bash scripts/enable-prod-security-report.sh --verify   # проверить cron, файлы и последний прогон
#
# На прод-хосте (всё от `sx3`, без sudo, по образцу enable-prod-db-backup.sh):
#
#   ~/.local/bin/metravel-security-report.py  копия scripts/security-report.py
#   ~/.local/bin/metravel-security-report     обёртка (0700): конфиг, лог, запуск
#   ~/.metravel-security-report.env           конфиг (0600): адрес, свои IP, хост
#   ~/logs/metravel-security-report.log       лог (0640), ротация 4×1 МБ
#   ~/.local/state/metravel/security-report-state.json  метрики прошлого прогона (дельты)
#   user crontab                              строка с маркером `# metravel-security-report`
#
# Root-логи (`auth.log`, `fail2ban.log`) скрипт читает одноразовым контейнером
# `alpine` с `-v /var/log:/hostlog:ro --network none` — тот же приём, что и в
# ручных разборах; это чтение, не эскалация. Документация: docs/ops/security-report.md

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./deploy-target.sh
source "${SCRIPT_DIR}/deploy-target.sh"

CRON_SCHEDULE="${CRON_SCHEDULE:-10 9 * * *}"   # время хоста (Europe/Minsk), после SEO-отчёта 09:00
REPORT_EMAIL="${REPORT_EMAIL:-metraveldev@gmail.com}"
REPORT_HOST="${REPORT_HOST:-metravel.by}"
# Свои адреса не считаются атакой и лимитом: публичный IPv4 этой машины плюс
# IPv6 хоста, с которого минутный монитор ротаций ходит в /health (#1964).
IGNORE_IPS="${IGNORE_IPS:-}"
MODE="install"

usage() {
  cat <<'USAGE'
Ежедневный security-отчёт прод-хоста на почту.

  (без аргументов)  установить скрипт, конфиг, лог и cron-строку (идемпотентно)
  --preview         собрать отчёт сейчас и напечатать (без письма)
  --run-now         собрать отчёт сейчас и отправить письмо
  --verify          проверить критерии приёмки #2721, ничего не меняя
  -h, --help        эта справка

Переменные окружения: CRON_SCHEDULE, REPORT_EMAIL, REPORT_HOST, IGNORE_IPS.
Адрес сервера — из .env.deploy (scripts/deploy-target.sh).
USAGE
}

case "${1:-}" in
  "") ;;
  --preview) MODE="preview" ;;
  --run-now) MODE="run-now" ;;
  --verify) MODE="verify" ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; echo "❌ неизвестный аргумент: $1" >&2; exit 2 ;;
esac

require_deploy_target

if [[ "$MODE" == "install" && -z "$IGNORE_IPS" ]]; then
  own_ip="$(curl -4 -s --max-time 10 https://ifconfig.me || true)"
  IGNORE_IPS="${own_ip:+$own_ip }2a0a:7d80:3:2::186"
fi

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

{
  # Константы — телом payload, не аргументами ssh: удалённый шелл переразбирает
  # командную строку, и `10 9 * * *` расщепляется по пробелам (см. db-backup).
  printf 'CRON_SCHEDULE=%q\nREPORT_EMAIL=%q\nREPORT_HOST=%q\nIGNORE_IPS=%q\nMODE=%q\n' \
    "$CRON_SCHEDULE" "$REPORT_EMAIL" "$REPORT_HOST" "$IGNORE_IPS" "$MODE"
  printf 'SCRIPT_B64=%q\n' "$(base64 < "${SCRIPT_DIR}/security-report.py" | tr -d '\n')"
  cat <<'REMOTE_MAIN'
set -Eeuo pipefail

ENV_FILE="$HOME/.metravel-security-report.env"
PY_FILE="$HOME/.local/bin/metravel-security-report.py"
WRAPPER="$HOME/.local/bin/metravel-security-report"
LOG_FILE="$HOME/logs/metravel-security-report.log"
STATE_FILE="$HOME/.local/state/metravel/security-report-state.json"
CRON_MARK="# metravel-security-report"

fail() { echo "❌ $*" >&2; exit 1; }

install_all() {
  echo "== преднастройка =="
  command -v python3 >/dev/null || fail "нет python3"
  [[ -x /usr/sbin/sendmail ]] || fail "нет /usr/sbin/sendmail"
  docker ps >/dev/null 2>&1 </dev/null || fail "docker недоступен пользователю $(id -un)"

  umask 077
  mkdir -p "$(dirname "$WRAPPER")" "$(dirname "$LOG_FILE")" "$(dirname "$STATE_FILE")"

  printf '%s' "$SCRIPT_B64" | base64 -d > "$PY_FILE"
  chmod 700 "$PY_FILE"
  python3 -m py_compile "$PY_FILE" || fail "скрипт не компилируется"

  # Значения через %q: обёртка делает `source`, и пробел или `$(` в адресе не
  # должны превращаться в команду.
  {
    echo "# Конфиг ежедневного security-отчёта (борд #2721)."
    echo "# Создан scripts/enable-prod-security-report.sh — правки руками перетрутся"
    echo "# следующей установкой; постоянные значения задавать через IGNORE_IPS/REPORT_EMAIL."
    printf 'SECURITY_REPORT_EMAIL=%q\nSECURITY_REPORT_HOST=%q\nSECURITY_REPORT_IGNORE_IPS=%q\nLOG_FILE=%q\nSTATE_FILE=%q\n' \
      "$REPORT_EMAIL" "$REPORT_HOST" "$IGNORE_IPS" "$LOG_FILE" "$STATE_FILE"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  cat > "$WRAPPER" <<'WRAPEOF'
#!/bin/bash
# Обёртка ежедневного security-отчёта (борд #2721).
# СГЕНЕРИРОВАНА scripts/enable-prod-security-report.sh — не править руками.
set -Eeuo pipefail
export LC_ALL=C.UTF-8 LANG=C.UTF-8
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set -a
# shellcheck disable=SC1091
. "$HOME/.metravel-security-report.env"
set +a

mkdir -p "$(dirname "$LOG_FILE")"
umask 027
LOG_MAX_BYTES="${LOG_MAX_BYTES:-1048576}"
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt "$LOG_MAX_BYTES" ]; then
  rm -f "${LOG_FILE}.3"
  for i in 2 1; do
    if [ -f "${LOG_FILE}.$i" ]; then mv "${LOG_FILE}.$i" "${LOG_FILE}.$((i + 1))"; fi
  done
  mv "$LOG_FILE" "${LOG_FILE}.1"
fi

if [ "${1:-}" != "--dry-run" ]; then
  exec >>"$LOG_FILE" 2>&1
fi
printf '[%s] security-report start\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# `|| rc=$?`, а не `rc=$?` после команды: под `set -e` упавший прогон иначе
# выходит до строки exit=, и --verify видит прошлый exit=0 (ложная приёмка).
rc=0
flock -n "$HOME/.metravel-security-report.lock" \
  python3 -I "$HOME/.local/bin/metravel-security-report.py" --state "$STATE_FILE" "$@" || rc=$?
printf '[%s] security-report exit=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$rc"
exit "$rc"
WRAPEOF
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
  ls -l "$ENV_FILE" "$PY_FILE" "$WRAPPER" "$LOG_FILE"
  crontab -l | grep -F "$CRON_MARK"
  echo "расписание в таймзоне хоста: $(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone)"
  echo "свои адреса: $IGNORE_IPS"
}

preview() {
  [[ -x "$WRAPPER" ]] || fail "сначала установка: без аргументов"
  "$WRAPPER" --dry-run
}

run_now() {
  [[ -x "$WRAPPER" ]] || fail "сначала установка: без аргументов"
  local rc=0
  # Ручной прогон не сдвигает базу дельт «ко вчера» утреннего письма.
  "$WRAPPER" --no-state || rc=$?
  echo "exit=$rc"
  tail -5 "$LOG_FILE"
  return "$rc"
}

verify() {
  local rc=0
  echo "== 1. расписание =="
  if crontab -l 2>/dev/null | grep -F "$CRON_MARK"; then :; else echo "❌ cron-строки нет"; rc=1; fi
  echo "== 2. файлы =="
  for f in "$ENV_FILE" "$PY_FILE" "$WRAPPER"; do
    if [[ -f "$f" ]]; then ls -l "$f"; else echo "❌ нет $f"; rc=1; fi
  done
  echo "== 3. последний прогон =="
  if [[ -f "$LOG_FILE" ]]; then
    local last_exit
    last_exit="$(grep -F 'security-report exit=' "$LOG_FILE" | tail -1 || true)"
    echo "${last_exit:-прогонов ещё не было}"
    [[ "$last_exit" == *"exit=0"* ]] || { echo "❌ последний прогон не завершился с кодом 0"; rc=1; }
    grep -F 'Security report ' "$LOG_FILE" | tail -1 | sed 's/^/  тема: /' || true
    # Только последний прогон: старый Traceback в ещё не повёрнутом логе не должен красить приёмку.
    if awk '/security-report start/{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' "$LOG_FILE" | grep -q 'Traceback'; then echo "❌ в последнем прогоне есть Traceback"; rc=1; fi
  else
    echo "❌ лога нет: $LOG_FILE"; rc=1
  fi
  echo "== 4. состояние для дельт =="
  if [[ -f "$STATE_FILE" ]]; then python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('generated_at'), d.get('metrics'))" "$STATE_FILE"; else echo "⏳ состояния ещё нет (появится после первого прогона)"; fi
  echo
  if [[ "$rc" -eq 0 ]]; then echo "✅ критерии приёмки #2721 выполнены"; else echo "⚠️ приёмка не закрыта"; fi
  return "$rc"
}

case "$MODE" in
  install) install_all ;;
  preview) preview ;;
  run-now) run_now ;;
  verify) verify ;;
esac
REMOTE_MAIN
} > "$payload"

ssh -o ConnectTimeout=20 -o BatchMode=yes "$PROD_SSH_TARGET" bash -s < "$payload"
