#!/bin/bash
# Единая точка, из которой deploy-скрипты берут адрес прод-сервера.
#
# Зачем отдельный файл
# --------------------
# Репозиторий публичный (github.com/kelios/metravel2), поэтому логин и IP
# боевого сервера в нём не хранятся: раньше пара «пользователь@адрес» была
# зашита дефолтом в `build-prod.sh`, `scripts/fix-prod.sh` и
# `scripts/fix-missing-chunk.sh`, то есть лежала в открытом виде вместе с
# путём деплоя. Теперь реквизиты живут только в локальном `.env.deploy`
# (он под `.gitignore`) или в переменных окружения CI.
#
# Использование
# -------------
#     source "$(dirname "$0")/deploy-target.sh"   # из scripts/
#     require_deploy_target
#     ssh "$PROD_SSH_TARGET" ...
#     rsync ./dist/ "$PROD_SSH_TARGET:$PROD_REMOTE_DIR/dist/"
#
# Переменные окружения имеют приоритет над `.env.deploy`, поэтому разовый
# прогон против другого хоста делается без правки файлов:
#
#     PROD_SSH_HOST=1.2.3.4 ./build-prod.sh prod

# shellcheck disable=SC2034  # переменные читают вызывающие скрипты

_deploy_target_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
_deploy_target_file="${DEPLOY_ENV_FILE:-$_deploy_target_root/.env.deploy}"

# Значения из окружения важнее файла: запоминаем их до подгрузки.
_deploy_target_env_user="${PROD_SSH_USER:-}"
_deploy_target_env_host="${PROD_SSH_HOST:-}"
_deploy_target_env_dir="${PROD_REMOTE_DIR:-}"

if [[ -f "$_deploy_target_file" ]]; then
  set -a
  # shellcheck disable=SC1090  # путь вычисляется в рантайме
  source "$_deploy_target_file"
  set +a
fi

PROD_SSH_USER="${_deploy_target_env_user:-${PROD_SSH_USER:-}}"
PROD_SSH_HOST="${_deploy_target_env_host:-${PROD_SSH_HOST:-}}"
PROD_REMOTE_DIR="${_deploy_target_env_dir:-${PROD_REMOTE_DIR:-}}"
PROD_SSH_TARGET="${PROD_SSH_USER}@${PROD_SSH_HOST}"

unset _deploy_target_root _deploy_target_file \
  _deploy_target_env_user _deploy_target_env_host _deploy_target_env_dir

# Валидирует конфигурацию и объясняет, что делать, если её нет. Без этого
# вызова скрипт ушёл бы в ssh с пустым хостом и упал невнятной ошибкой.
require_deploy_target() {
  local missing=()
  [[ -n "$PROD_SSH_USER" ]] || missing+=("PROD_SSH_USER")
  [[ -n "$PROD_SSH_HOST" ]] || missing+=("PROD_SSH_HOST")
  [[ -n "$PROD_REMOTE_DIR" ]] || missing+=("PROD_REMOTE_DIR")

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "❌ Не задан адрес прод-сервера: ${missing[*]}" >&2
    echo >&2
    echo "Реквизиты не хранятся в репозитории (он публичный). Заполни их один раз:" >&2
    echo "    cp .env.deploy.example .env.deploy   # и подставь значения" >&2
    echo >&2
    echo "Либо передай их окружением:" >&2
    echo "    PROD_SSH_USER=… PROD_SSH_HOST=… PROD_REMOTE_DIR=… $0" >&2
    return 1
  fi

  PROD_SSH_TARGET="${PROD_SSH_USER}@${PROD_SSH_HOST}"
  return 0
}

# ---------------------------------------------------------------------------
# Имена docker-контейнеров прода
# ---------------------------------------------------------------------------
#
# Имя контейнера — не константа, а производная от версии compose и имени
# проекта: v1 склеивал `<project>_<service>_<index>`, v2 — через дефисы. На
# metravel.by 29.08.2026 пересоздали app и nginx, они уехали на дефисы
# (`metravel_app_1` → `metravel-app-1`), а базу и redis не трогали, поэтому на
# одном хосте живут ОБЕ схемы сразу. Вписанное вручную имя ломается при первом
# же пересоздании, и ломается по-разному: часть инструментов падала громко, а
# детектор мёртвых ссылок печатал «всё хорошо» с кодом 0, не прочитав лога
# (борд #733 — первый случай, #1636 — вынос резолва сюда).
#
# Поэтому регулярка имени существует РОВНО В ОДНОМ месте — в снипете ниже.
# Потребители забирают её, а не переписывают:
#
#   * удалённый shell (`ssh … bash -s`, heredoc деплоя) —
#     `metravel_container_remote_snippet` печатает готовое определение функции,
#     его вставляют в тело удалённого скрипта;
#   * локальный bash, которому нужно имя на проде —
#     `metravel_resolve_container_over_ssh <service>`;
#   * Node/Python — забирают тот же снипет через
#     `bash -c 'source scripts/deploy-target.sh; metravel_container_remote_snippet'`.
#
# Сервис пишется так, как его зовёт compose: app, nginx, metravel-gis, redis,
# redis-images. Внутренние дефисы имени сервиса схема не трогает — меняется
# только разделитель между project/service/index.

# Печатает POSIX-sh определение `metravel_resolve_container` для вставки в
# удалённый скрипт. Функция принимает сервис и (необязательно) явное имя,
# печатает найденное имя в stdout и возвращает ненулевой код с диагностикой в
# stderr, если контейнера нет. Проверка существования выполняется и для явного
# имени: без неё опечатка в `--container` давала ложное зелёное.
metravel_container_remote_snippet() {
  cat <<'METRAVEL_CONTAINER_SNIPPET'
# Каждый вызов docker изолирует stdin через </dev/null: у части потребителей
# удалённая программа САМА является stdin (`ssh … bash -s`), и команда, которая
# читает stdin, проглатывает ещё не выполненный остаток скрипта — bash выходит
# с 0 на получившемся EOF, а шаги молча пропускаются (инцидент 2026-08-11,
# правило зафиксировано в build-prod.sh).
metravel_resolve_container() {
  _mrc_service="${1:-}"
  _mrc_explicit="${2:-}"
  if [ -z "$_mrc_service" ]; then
    echo 'ERROR: metravel_resolve_container: не передан сервис' >&2
    return 2
  fi
  _mrc_re="^metravel[-_]${_mrc_service}[-_]1$"
  if [ -n "$_mrc_explicit" ]; then
    _mrc_name="$_mrc_explicit"
  else
    _mrc_name="$(docker ps --format '{{.Names}}' </dev/null | grep -E "$_mrc_re" | head -1)"
  fi
  if [ -z "$_mrc_name" ]; then
    echo "ERROR: не найден контейнер metravel/${_mrc_service} (искали ${_mrc_re})" >&2
    docker ps --format '{{.Names}}' </dev/null >&2
    return 1
  fi
  if ! docker ps --format '{{.Names}}' </dev/null | grep -Fxq "$_mrc_name"; then
    echo "ERROR: контейнер '${_mrc_name}' не запущен" >&2
    docker ps --format '{{.Names}}' </dev/null >&2
    return 1
  fi
  printf '%s\n' "$_mrc_name"
}
METRAVEL_CONTAINER_SNIPPET
}

# Резолвит имя контейнера на прод-хосте и печатает его в stdout. Причину отказа
# не глотает: без неё недоступный ssh, чужой хост и реально отсутствующий
# контейнер выглядят одинаково.
metravel_resolve_container_over_ssh() {
  local service="${1:?metravel_resolve_container_over_ssh: нужен сервис}"
  local explicit="${2:-}"
  local err_file name rc

  require_deploy_target >/dev/null || return 1

  err_file="$(mktemp)"
  name="$(ssh -o ConnectTimeout=20 -o BatchMode=yes "$PROD_SSH_TARGET" \
    bash -s -- "$service" "$explicit" 2>"$err_file" <<REMOTE
$(metravel_container_remote_snippet)
metravel_resolve_container "\$1" "\$2"
REMOTE
  )"
  rc=$?

  if [[ $rc -ne 0 || -z "$name" ]]; then
    echo "не найден контейнер metravel/${service} на '$PROD_SSH_TARGET'" >&2
    local reason
    reason="$(cat "$err_file" 2>/dev/null || true)"
    [[ -n "$reason" ]] && echo "причина: $reason" >&2
    rm -f "$err_file"
    return 1
  fi

  rm -f "$err_file"
  printf '%s\n' "$name"
}
