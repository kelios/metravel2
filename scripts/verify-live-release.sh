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
# (прод ответил чужим sha — повтор не поможет; либо маркер все попытки отвечал
# без полного sha, #3305) и «хост не ответил» (ответа нет — релиз мог быть
# опубликован, это недоступность, а не откат). Итог считается по всем попыткам,
# а не по последней (#3314): sha, прочитанный однажды, остаётся доказательством
# публикации, а «все попытки» в сообщении значит именно все; смешанный ряд
# (маркер то без sha, то молчит) называется своими числами.
set -Euo pipefail

SHA="${1:?usage: verify-live-release.sh <sha>}"
SHORT="${SHA:0:9}"
ORIGIN="${VERIFY_LIVE_ORIGIN:-https://metravel.by}"
ATTEMPTS="${VERIFY_LIVE_ATTEMPTS:-3}"
DELAY="${VERIFY_LIVE_RETRY_DELAY:-12}"

# Тот же чтец, что у гейта источника перед выкатом (#3272): «до» и «после»
# одного выката читают /.build-source.json одним кодом.
LIVE_BUILD_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/live-build-source.js"
# Печатает sha, `no-sha` (хост ответил, полного sha в маркере нет) либо пусто.
live_state() {
  node "$LIVE_BUILD_SOURCE" --state "$ORIGIN" 2>/dev/null || true
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
state=''
smoke_output=''
smoke_failed=0
# Попытки по ответу маркера: ожидаемый sha, ответ без полного sha, без ответа.
matched=0
no_sha=0
silent=0
for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  state="$(live_state)"
  seen=''
  [[ "$state" == "no-sha" ]] || seen="$state"
  if [[ -n "$seen" && "$seen" != "$SHA" ]]; then
    echo "❌ Релиз не опубликован: прод отдаёт sha $seen, ожидался $SHA"
    exit 1
  fi
  if [[ "$state" == "no-sha" ]]; then
    no_sha=$((no_sha + 1))
  elif [[ -z "$seen" ]]; then
    silent=$((silent + 1))
  else
    matched=$((matched + 1))
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
    echo "⚠️ Попытка $attempt из $ATTEMPTS: sha ${seen:-$([[ "$state" == "no-sha" ]] && echo 'в маркере нет' || echo 'не получен')}, смоук $([[ "$smoke_failed" == "0" ]] && echo 200 || echo 'не 200') — повтор через $DELAY с"
    sleep "$DELAY"
  fi
done

printf '%s\n' "$smoke_output"
if ((matched == ATTEMPTS)); then
  echo "❌ Релиз $SHORT опубликован, но смоук прода не прошёл за $ATTEMPTS попыток"
elif ((matched > 0)); then
  echo "❌ Релиз $SHORT опубликован (sha прочитан в $matched из $ATTEMPTS попыток), но ни одна попытка не дала sha и смоук 200 вместе"
elif ((no_sha == ATTEMPTS)); then
  echo "❌ Релиз не опубликован: /.build-source.json прода отвечает без полного sha за $ATTEMPTS попыток, ожидался $SHA"
elif ((no_sha > 0)); then
  echo "❌ Релиз $SHORT не подтверждён: /.build-source.json прода ответил без полного sha в $no_sha из $ATTEMPTS попыток и не ответил в $silent, ожидался $SHA"
else
  echo "❌ Хост не ответил на /.build-source.json за $ATTEMPTS попыток — релиз $SHORT мог быть опубликован, это недоступность прода"
fi
exit 1
