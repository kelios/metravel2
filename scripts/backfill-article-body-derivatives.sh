#!/usr/bin/env bash
# Догон предгенерации производных для тела статей (`article_body`).
#
# ЗАЧЕМ. `docs/features/images.md` §1.3: производные обязаны лежать готовыми,
# ресайз в момент запроса — переходное состояние (#1136, #1168). Переключение в
# durable-режим завязано на покрытие: пока семейство не покрыто на 100 %,
# fail-safe держит его на динамике. Замер 2026-08-09 по
# `GET /api/media/proxy-contract` (v9):
#
#   article_body   dynamic_transform      6650 мастеров, 5607 полных, 84.3 %
#   travel         durable_s3_derivatives 5181 / 5181, 100 %
#   route_point    durable_s3_derivatives 2529 / 2529, 100 %
#   quest_cover    durable_s3_derivatives  139 /  139, 100 %
#
# То есть `article_body` — ЕДИНСТВЕННОЕ семейство, которое не доехало. Прогон
# #1180 закрывал его 2026-08-03 при 1 313 мастерах; сегодня их 6 650, потому что
# миграция тел статей (#1245) и чистка base64 (#1320) перезалили тысячи кадров
# уже ПОСЛЕ того прогона. Недостача — 1 043 производные.
#
# ЧТО ДЕЛАЕТ. Гоняет штатную backend-команду `backfill_image_derivatives`
# партиями с курсором. Своей логики генерации здесь нет и быть не должно: набор
# ширин и качество берутся из `metravel_shared/image_storage_policy.py`.
#
# ПОЧЕМУ ПАРТИЯМИ. Прод — 1 vCPU и 1 867 МБ RAM на хост. В #1180 сплошной прогон
# систематически убивали SIGKILL (глобальный OOM-killer, не cgroup-лимит), и
# каждое убийство отбрасывало позицию в начало, потому что `next_cursor`
# печатается только по завершении прохода. Партия + персистентный курсор делают
# убийство ценой одной партии.
#
# ЗАВЕРШЕНИЕ определяется по `objects_visited == 0` на полном проходе, а НЕ по
# `failed == 0`: строки БД с исчезнувшими в S3 файлами всегда дают `missing`, и
# ожидание нулевых ошибок не сойдётся никогда. `next_cursor` присутствует в
# ответе ВСЕГДА, в том числе после полного обхода, — по нему судить о полноте
# нельзя.
#
# Использование:
#   scripts/backfill-article-body-derivatives.sh --dry-run
#   scripts/backfill-article-body-derivatives.sh --write
#   scripts/backfill-article-body-derivatives.sh --write --limit 200 --resume
#
# Прогресс и курсор: .codex-temp/ops/backfill-article-body.{cursor,log}

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/deploy-target.sh
source "$REPO_ROOT/scripts/deploy-target.sh"

OPS_DIR="$REPO_ROOT/.codex-temp/ops"
CURSOR_FILE="$OPS_DIR/backfill-article-body.cursor"
LOG_FILE="$OPS_DIR/backfill-article-body.log"
LOCK_FILE="$OPS_DIR/backfill-article-body.lock"

MODEL="media_assets.traveldescriptionimages"
# Прогон обязан идти под тем же uid, что и веб-процесс контейнера.
#
# Команда берёт ДВА файловых лока в /tmp: свой (`metravel-backfill-image-derivatives`)
# и общий лок обработки изображений (`metravel-image-upload-processing`), который
# создаёт gunicorn при первой же загрузке картинки. Оба с правами 640, то есть
# писать в них может только владелец. `docker exec` без `-u` заходит как root и
# упирается в лок, созданный приложением (`PermissionError` на upload-локе), а
# после первого же root-запуска его собственный лок становится недоступен уже для
# приложения. Единственная непротиворечивая позиция — всегда ходить под uid
# веб-процесса.
CONTAINER_UID="1984"
MODE="--dry-run"
BATCH_LIMIT=200
BATCH_SIZE=10
SLEEP_MS=150
RESUME=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) MODE="--dry-run"; shift ;;
    --write) MODE="--write --confirm BACKFILL_IMAGE_DERIVATIVES"; shift ;;
    --limit) BATCH_LIMIT="$2"; shift 2 ;;
    --batch-size) BATCH_SIZE="$2"; shift 2 ;;
    --sleep-ms) SLEEP_MS="$2"; shift 2 ;;
    --resume) RESUME=1; shift ;;
    *) echo "неизвестный аргумент: $1" >&2; exit 2 ;;
  esac
done

# Имя контейнера резолвится на проде, а не хардкодится: compose v2 при
# пересоздании переименовал его с подчёркиваний на дефисы (metravel_app_1 →
# metravel-app-1) и прогон падал с 'No such container'. Матчим оба разделителя,
# поэтому резолв взят из общей функции scripts/deploy-target.sh, где регулярка
# имени существует в единственном экземпляре (#1636).
#
# Резолвим ОДИН раз и здесь же падаем на пустом результате. Без этой проверки
# пустое имя схлопывало аргументы в `docker exec -u 1984 python manage.py …`,
# docker принимал `python` за имя контейнера, ошибка гасилась фильтром
# `grep -E '^\{'` в цикле ниже, и прогон три раза по 20 с сообщал «партия не
# прошла трижды» — то есть обвинял прод вместо неверного имени.
#
# Место выбрано специально: ПОСЛЕ разбора аргументов (иначе опечатка во флаге
# сначала оплачивала бы ssh и падала с «не найден контейнер» вместо «неизвестный
# аргумент») и ДО взятия лока (иначе неудачный резолв оставлял бы lock-файл).
if ! CONTAINER="$(metravel_resolve_container_over_ssh app)"; then
  # Диагностику печатает сам резолвер (недоступный ssh, чужой хост и реально
  # отсутствующий контейнер там различаются). Код 4 — контракт этого скрипта.
  exit 4
fi
echo "app-контейнер: $CONTAINER"

mkdir -p "$OPS_DIR"

# Эксклюзивность: второй прогон по тому же target ломает курсор и удваивает
# нагрузку на единственный vCPU.
if [[ -e "$LOCK_FILE" ]]; then
  owner="$(cat "$LOCK_FILE" 2>/dev/null || echo '?')"
  if kill -0 "${owner%% *}" 2>/dev/null; then
    echo "уже идёт прогон: $owner — второй экземпляр не запускаю" >&2
    exit 3
  fi
  echo "снимаю протухший lock: $owner" >&2
  rm -f "$LOCK_FILE"
fi
echo "$$ $(date -u +%FT%TZ)" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cursor=""
if [[ "$RESUME" == "1" && -s "$CURSOR_FILE" ]]; then
  cursor="$(cat "$CURSOR_FILE")"
  echo "продолжаю с курсора: $cursor"
fi

coverage() {
  curl -s --max-time 30 'https://metravel.by/api/media/proxy-contract' \
    | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    f=d['route_behavior']['model_owned']['family_modes']['article_body']
    c=f['coverage']
    print(f\"{f['active_mode']} | {c['complete_masters']}/{c['masters']} мастеров | {c['coverage_percent']:.1f}% | производных {c['existing_derivatives']}/{c['expected_derivatives']}\")
except Exception as exc:
    print(f'контракт недоступен: {exc}')
"
}

echo "=== покрытие ДО прогона ==="
coverage | tee -a "$LOG_FILE"
echo

batch=0
while true; do
  batch=$((batch + 1))
  # Строка, а не массив: под `set -u` в bash 3.2 (системный на macOS) раскрытие
  # пустого массива само по себе считается обращением к неустановленной
  # переменной и валит прогон на первой же партии.
  cursor_flag=""
  [[ -n "$cursor" ]] && cursor_flag="--cursor $cursor"

  echo "--- партия $batch (курсор: ${cursor:-начало}) $(date -u +%FT%TZ) ---" | tee -a "$LOG_FILE"

  # Обрыв ssh и разовый отказ прода не должны стоить всего прогона: партия
  # идемпотентна (уже созданные объекты она пропускает), поэтому повтор дешевле
  # остановки. Останавливаемся только если партия не прошла трижды подряд.
  summary=""
  for attempt in 1 2 3; do
    summary="$(ssh -o ConnectTimeout=20 "$PROD_SSH_TARGET" \
      "docker exec -u $CONTAINER_UID $CONTAINER python manage.py backfill_image_derivatives \
         --model $MODEL $MODE \
         --limit $BATCH_LIMIT --batch-size $BATCH_SIZE --sleep-ms $SLEEP_MS \
         $cursor_flag" 2>&1 | grep -E '^\{' | tail -1 || true)"
    [[ -n "$summary" ]] && break
    echo "   попытка $attempt не вернула summary, повтор через 20 с" | tee -a "$LOG_FILE"
    sleep 20
  done

  if [[ -z "$summary" ]]; then
    echo "партия $batch не прошла трижды — останавливаюсь, позиция сохранена в $CURSOR_FILE" | tee -a "$LOG_FILE"
    exit 1
  fi

  echo "$summary" >> "$LOG_FILE"

  read -r visited created would failed next <<<"$(python3 -c "
import json,sys
s=json.loads(sys.argv[1])
print(s.get('objects_visited',0), s.get('created',0), s.get('would_create',0),
      s.get('failed',0), s.get('next_cursor') or '')
" "$summary")"

  echo "   просмотрено $visited | создано $created | к созданию $would | ошибок $failed" | tee -a "$LOG_FILE"

  # Полнота — только по нулевому обходу. `next_cursor` есть всегда, даже когда
  # обходить уже нечего, и остановка по нему дала бы ложное «готово».
  if [[ "$visited" == "0" ]]; then
    echo "полный проход не дал новых объектов — обход завершён" | tee -a "$LOG_FILE"
    break
  fi

  cursor="$next"
  printf '%s' "$cursor" > "$CURSOR_FILE"
  sleep 2
done

# Покрытие в публичном контракте — СНИМОК, а не живое значение: его считает
# отдельная команда и кладёт в контракт вместе с `measured_at`. Без пересчёта
# созданные объекты не видны, семейство остаётся в старом режиме, и прогон
# выглядит бесполезным. Замер 2026-08-09: `measured_at` был 05:59, прогон шёл с
# 06:09 — контракт всё это время показывал прежние 84,3 %.
echo
echo "=== пересчёт метрики покрытия ===" | tee -a "$LOG_FILE"
ssh -o ConnectTimeout=20 "$PROD_SSH_TARGET" \
  "docker exec -u $CONTAINER_UID $CONTAINER python manage.py measure_image_derivative_coverage" \
  2>&1 | tail -3 | tee -a "$LOG_FILE"

echo
echo "=== покрытие ПОСЛЕ прогона ===" | tee -a "$LOG_FILE"
coverage | tee -a "$LOG_FILE"
