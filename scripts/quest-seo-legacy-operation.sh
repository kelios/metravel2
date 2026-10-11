#!/bin/bash
# Sourced remotely; mutations and the app-owned flock live in one process.
quest_seo_legacy_operation() {
  local action="$1"
  shift
  local exec_args=(exec)
  case "$action" in legacy-prune | legacy-prepare | legacy-chunk) exec_args+=(-u 0) ;; esac
  docker "${exec_args[@]}" "$app_ctr" python -c \
    "import base64;exec(compile(base64.b64decode('$QUEST_SEO_TRANSPORT_B64'),'<quest-seo-transport>','exec'))" \
    "$action" "$@" </dev/null
}
