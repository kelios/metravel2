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
