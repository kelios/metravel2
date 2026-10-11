#!/bin/bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-target.sh"
require_deploy_target
export PROD_SSH_TARGET PROD_REMOTE_DIR
export QUEST_SEO_APP_CONTAINER="$(metravel_resolve_container_over_ssh app)"
export QUEST_SEO_NGINX_CONTAINER="$(metravel_resolve_container_over_ssh nginx)"
exec node "$SCRIPT_DIR/quest-seo-operation.js" "$@"
