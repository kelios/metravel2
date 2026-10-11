#!/bin/bash
# Срочный фикс: скопировать новый CustomHeader chunk как старый
# Это решит проблему для пользователей с закэшированным старым _layout chunk

set -e

# Адрес сервера не зашит в скрипт: репозиторий публичный. Реквизиты приходят
# из .env.deploy или окружения — см. scripts/deploy-target.sh.
# shellcheck source=scripts/deploy-target.sh
source "$(dirname "${BASH_SOURCE[0]}")/deploy-target.sh"
require_deploy_target
TRANSPORT_B64="$(base64 < "$(dirname "${BASH_SOURCE[0]}")/quest-seo-transport.py" | tr -d '\n')"
LEGACY_B64="$(base64 < "$(dirname "${BASH_SOURCE[0]}")/quest-seo-legacy-operation.sh" | tr -d '\n')"
APP_CTR="$(metravel_resolve_container_over_ssh app)"

OLD_CHUNK="CustomHeader-35c08b6fda505a901ff6d2adcd502571.js"
NEW_CHUNK="CustomHeader-c172213d0a07765fd9eee66b10d66ebf.js"

echo "Копирую $NEW_CHUNK как $OLD_CHUNK..."

ssh "$PROD_SSH_TARGET" bash -s -- "$PROD_REMOTE_DIR" "$APP_CTR" "$TRANSPORT_B64" "$LEGACY_B64" "$NEW_CHUNK" "$OLD_CHUNK" <<'REMOTE_CHUNK_SCRIPT'
set -euo pipefail
eval "$(printf '%s' "$4" | base64 -d)"
app_ctr="$2"
QUEST_SEO_TRANSPORT_B64="$3"
legacy_token=$(quest_seo_legacy_operation legacy-check)
quest_seo_legacy_operation legacy-chunk "$legacy_token" "$5" "$6"
echo 'Готово! Старый chunk теперь доступен.'
REMOTE_CHUNK_SCRIPT
