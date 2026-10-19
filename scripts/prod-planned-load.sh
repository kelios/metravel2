#!/bin/bash
# Окно плановой нагрузки прода (#2663).
#
# Выкат фронта 10–12 минут держит единственное ядро прода на 100 % (сбор
# данных с прода, заливка, публикация квестов), а хостовый ~/monitor.sh
# считает CPU > 95 % при load1 > 1 на двух замерах подряд аварией: каждый
# выкат слал владельцу пару писем «System alert / recovered». Файл окна
# говорит монитору, что нагрузка плановая. Монитор пропускает только причину
# «CPU», диск и память алертят как раньше, а окно, которое не успел снять
# упавший выкат, истекает само (монитор не верит сроку дальше 30 мин).
#
#   prod-planned-load.sh open  <name> <ttl-seconds> <label>
#   prod-planned-load.sh close <name>
#
# Файл ~/metravel-monitor/planned-load.d/<name>: одна строка
# `<expires_epoch> <label>`. Сбой ssh — код 1; вызывающий выкат не падает.
set -Eeuo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/deploy-target.sh"

usage() {
  echo "Usage: prod-planned-load.sh open <name> <ttl-seconds> <label> | close <name>" >&2
  exit 2
}

action="${1:-}"
name="${2:-}"
ttl="${3:-0}"
label="${4:-$name}"
[[ "$name" =~ ^[a-z0-9-]{1,40}$ ]] || usage
case "$action" in
  open)
    # Аргументы уходят в командную строку ssh: только безопасные символы.
    [[ "$ttl" =~ ^[0-9]+$ ]] && (( ttl >= 60 && ttl <= 1800 )) || usage
    [[ "$label" =~ ^[A-Za-z0-9:._-]{1,80}$ ]] || usage
    ;;
  close) ;;
  *) usage ;;
esac

require_deploy_target >/dev/null || exit 1

# Программа идёт stdin'ом `bash -s`, поэтому в ней нет команд, читающих stdin.
ssh -o BatchMode=yes -o ConnectTimeout=10 "$PROD_SSH_TARGET" \
  bash -s -- "$action" "$name" "$ttl" "$label" <<'REMOTE'
set -eu
dir="$HOME/metravel-monitor/planned-load.d"
case "$1" in
  open)
    mkdir -p "$dir"
    printf '%s %s\n' "$(( $(date +%s) + $3 ))" "$4" > "$dir/.$2.tmp"
    mv -f "$dir/.$2.tmp" "$dir/$2"
    ;;
  close)
    rm -f "$dir/$2"
    ;;
esac
REMOTE
