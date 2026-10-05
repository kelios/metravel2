#!/usr/bin/env bash

# Disk gate of the frontend deploy. Runs on the prod host, shipped by
# build-prod.sh the same way as scripts/deploy-expo-overlay.sh.
#
#   deploy-disk-guard.sh preflight <checkout> <payload-kib> <reserve-mb> <backend-build-mb>
#       Before the upload. rsync materialises the whole release in the staging
#       tree (`--copy-dest` copies unchanged files instead of linking them), so
#       the deploy needs payload + reserve of free space or it fills the disk
#       mid-upload and takes the database down with it; while a backend image
#       build is running, its need is added on top. Exit 1 = refuse, and
#       nothing has been written to the server yet.
#   deploy-disk-guard.sh report <checkout> <dist-dir> <backend-build-mb>
#       After the swap and cleanup. One line for the deploy report plus a
#       warning once the backend can no longer build its image; never fails
#       the deploy.
#
# The 15 GB prod disk has no owner of the total: every class is bounded on its
# own (image retention, nginx cache max_size, log rotation, overlay window) and
# their limits add up to more than the disk (#2186). The backend image build
# takes 1.2-1.3 GB and its own preflight refuses below 1536 MiB free; a
# frontend upload started in the middle of that build is what the preflight
# here has to catch — the reverse order is caught by the backend's preflight.

set -Eeuo pipefail
IFS=$'\n\t'

runbook='docs/ops/prod-disk-growth.md'

usage() {
  echo "Usage: deploy-disk-guard.sh preflight <checkout> <payload-kib> <reserve-mb> <backend-build-mb>" >&2
  echo "       deploy-disk-guard.sh report <checkout> <dist-dir> <backend-build-mb>" >&2
  exit 2
}

require_integer() {
  if [[ ! "$2" =~ ^[0-9]+$ ]]; then
    echo "ERROR: $1 must be a non-negative integer" >&2
    exit 2
  fi
}

# `df -Pk` is the one portable form (GNU on the host, BSD in the test run):
# 1024-blocks, used, available, capacity. Percent is taken from df itself so
# the report shows the same number as the owner's `df -h`.
read_disk() {
  local line
  line="$(df -Pk "$1" | awk 'NR == 2 { sub(/%/, "", $5); print $3, $4, $5 }')"
  IFS=' ' read -r DISK_USED_KIB DISK_FREE_KIB DISK_USED_PCT <<< "$line"
  if [[ ! "$DISK_USED_KIB" =~ ^[0-9]+$ || ! "$DISK_FREE_KIB" =~ ^[0-9]+$ || ! "$DISK_USED_PCT" =~ ^[0-9]+$ ]]; then
    echo "ERROR: cannot read free space of $1" >&2
    return 1
  fi
}

# The backend builds its image outside any lock (its runbook: preflight,
# mark-rollback, `docker compose build app`, then the rollout wrapper), so a
# running build is recognised by its client process: `docker compose … build`,
# `docker-compose … build`, `docker build`, `docker buildx build`, `up --build`.
# A false match only costs a refusal with the reason printed.
backend_build_running() {
  pgrep -f 'docker.*( |--)build( |$)' >/dev/null 2>&1
}

# Trees an interrupted deploy leaves behind. The deploy removes them itself,
# but only after the upload, so until then they are counted as used space.
leftover_mb() {
  local checkout="$1" total_kib=0 size_kib entry
  for entry in "$checkout"/dist "$checkout"/static/dist.new "$checkout"/static/dist.old* "$checkout"/static/dist.failed.*; do
    [[ -e "$entry" ]] || continue
    size_kib="$(du -sk "$entry" 2>/dev/null | awk '{ print $1 }' || true)"
    if [[ "$size_kib" =~ ^[0-9]+$ ]]; then
      total_kib=$(( total_kib + size_kib ))
    fi
  done
  echo $(( total_kib / 1024 ))
}

preflight() {
  local checkout="$1" payload_kib="$2" reserve_mb="$3" backend_build_mb="$4"
  local free_mb payload_mb required_mb left_mb leftovers tool

  require_integer payload-kib "$payload_kib"
  require_integer reserve-mb "$reserve_mb"
  require_integer backend-build-mb "$backend_build_mb"

  # The overlay step needs both after the upload and the swap staging; a host
  # without them must be refused here, not with a half-published tree.
  for tool in perl cpio; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "❌ На проде нет \`$tool\`: без него перенос старых чанков откажет уже после заливки. Заливка не начата"
      return 1
    fi
  done

  read_disk "$checkout"

  free_mb=$(( DISK_FREE_KIB / 1024 ))
  payload_mb=$(( (payload_kib + 1023) / 1024 ))
  required_mb=$(( payload_mb + reserve_mb ))
  left_mb=$(( free_mb - payload_mb ))

  if backend_build_running; then
    required_mb=$(( required_mb + backend_build_mb ))
    if (( free_mb < required_mb )); then
      echo "❌ Идёт сборка образа бэкенда: ей нужно до ${backend_build_mb} МБ, заливке релиза — ${payload_mb} МБ и ${reserve_mb} МБ резерва, а свободно ${free_mb} МБ"
      echo "❌ Заливка не начата. Повторите выкат после завершения сборки; состав диска и порядок действий — $runbook"
      return 1
    fi
  elif (( free_mb < required_mb )); then
    echo "❌ На диске прода свободно ${free_mb} МБ, а заливке релиза нужно ${payload_mb} МБ и ${reserve_mb} МБ резерва"
    leftovers="$(leftover_mb "$checkout")"
    if (( leftovers > 0 )); then
      echo "❌ ${leftovers} МБ на диске занимают каталоги прерванного выката (dist, static/dist.new, dist.old, dist.failed): выкат снимает их сам, но уже после заливки"
    fi
    echo "❌ Заливка не начата. Освободите место по $runbook и повторите выкат"
    return 1
  fi

  echo "📊 Диск прода перед заливкой: занято ${DISK_USED_PCT} %, свободно ${free_mb} МБ; релиз ${payload_mb} МБ, резерв ${reserve_mb} МБ"
  if (( left_mb < backend_build_mb )); then
    echo "⚠️ На время заливки останется ${left_mb} МБ — меньше ${backend_build_mb} МБ, нужных сборке образа бэкенда: выкат бэкенда в эти минуты остановит его собственный preflight"
  fi
}

report() {
  local checkout="$1" dist_dir="$2" backend_build_mb="$3"
  local free_mb dist_mb='?'

  require_integer backend-build-mb "$backend_build_mb"
  read_disk "$checkout"
  free_mb=$(( DISK_FREE_KIB / 1024 ))
  if [[ -d "$dist_dir" ]]; then
    # du exits non-zero on one unreadable entry and still prints the total.
    dist_mb="$(du -sk "$dist_dir" 2>/dev/null | awk '{ printf "%d", ($1 + 1023) / 1024 }' || true)"
    dist_mb="${dist_mb:-?}"
  fi

  echo "📊 Диск прода после выката: занято ${DISK_USED_PCT} %, свободно ${free_mb} МБ; $dist_dir — ${dist_mb} МБ"
  # A percentage would fire on every deploy: the bounds of the other classes
  # alone keep this disk above 80 %. The warning is tied to a consequence
  # instead — below this much free space the backend cannot be rolled out.
  if (( free_mb < backend_build_mb )); then
    echo "⚠️ На диске прода свободно ${free_mb} МБ — меньше ${backend_build_mb} МБ, нужных сборке образа бэкенда: выкат бэкенда сейчас невозможен. Состав диска и порядок действий — $runbook"
  fi
}

command="${1:-}"
case "$command" in
  preflight)
    [[ $# -eq 5 ]] || usage
    preflight "$2" "$3" "$4" "$5"
    ;;
  report)
    [[ $# -eq 4 ]] || usage
    report "$2" "$3" "$4"
    ;;
  *)
    usage
    ;;
esac
