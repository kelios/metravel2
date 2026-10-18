#!/bin/bash
# Финальная сверка прода после выката (#2448): /.build-source.json отдаёт
# выкаченный sha, а /health, / и /api/travels/ — 200.
#
#   scripts/verify-live-release.sh <sha>
#
# Одна попытка без повтора давала exit 1 при опубликованном релизе: сразу после
# публикации одноядерный прод ~25 с не отвечал на /health и статику (выкат
# 34f885d84, 17.10.2026), а через минуту всё было 200. Повтор ограничен, как у
# бэкенд-выката: 10–15 с между попытками. Итог различает «релиз не опубликован»
# (прод ответил чужим sha — повтор не поможет) и «хост не ответил» (sha не
# получен — релиз мог быть опубликован, это недоступность, а не откат).
set -Euo pipefail

SHA="${1:?usage: verify-live-release.sh <sha>}"
SHORT="${SHA:0:9}"
ORIGIN="${VERIFY_LIVE_ORIGIN:-https://metravel.by}"
ATTEMPTS="${VERIFY_LIVE_ATTEMPTS:-3}"
DELAY="${VERIFY_LIVE_RETRY_DELAY:-12}"

live_sha() {
  curl -fsS --max-time 10 "$ORIGIN/.build-source.json" 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).sha||""))}catch{}})' \
    || true
}

# Печатает строки кодов; код возврата 0 — все три URL ответили 200.
smoke() {
  local url code failed=0
  for url in "$ORIGIN/health" "$ORIGIN/" "$ORIGIN/api/travels/?perPage=1"; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || true)"
    echo "   ${code:-000}  $url"
    [[ "$code" == "200" ]] || failed=1
  done
  return "$failed"
}

seen=''
smoke_output=''
smoke_failed=0
for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  seen="$(live_sha)"
  if [[ -n "$seen" && "$seen" != "$SHA" ]]; then
    echo "❌ Релиз не опубликован: прод отдаёт sha $seen, ожидался $SHA"
    exit 1
  fi
  smoke_failed=0
  smoke_output="$(smoke)" || smoke_failed=1
  if [[ "$seen" == "$SHA" && "$smoke_failed" == "0" ]]; then
    printf '%s\n' "$smoke_output"
    if ((attempt > 1)); then
      echo "⚠️ Прод ответил только с попытки $attempt из $ATTEMPTS — сразу после публикации он был недоступен"
    fi
    echo "✅ Прод отдаёт /.build-source.json с sha $SHORT"
    echo "✅ Смоук прода: /health, /, /api/travels/ — 200"
    exit 0
  fi
  if ((attempt < ATTEMPTS)); then
    echo "⚠️ Попытка $attempt из $ATTEMPTS: sha ${seen:-не получен}, смоук $([[ "$smoke_failed" == "0" ]] && echo 200 || echo 'не 200') — повтор через $DELAY с"
    sleep "$DELAY"
  fi
done

printf '%s\n' "$smoke_output"
if [[ -z "$seen" ]]; then
  echo "❌ Хост не ответил на /.build-source.json за $ATTEMPTS попыток — релиз $SHORT мог быть опубликован, это недоступность прода"
else
  echo "❌ Релиз $SHORT опубликован, но смоук прода не прошёл за $ATTEMPTS попыток"
fi
exit 1
