#!/bin/sh
# Shared stdio entry point. Keep stdout reserved for JSON-RPC.
set -eu

fail() {
  printf 'metravel-task-board: %s\n' "$*" >&2
  exit 1
}

check=false
if [ "${1:-}" = "--check" ]; then
  check=true
  shift
fi
[ "$#" -le 1 ] || fail "usage: launch-task-board-mcp.sh [--check] [frontend-directory]"

project_dir=${1:-$(dirname "$0")/..}
checkout=$(git -C "$project_dir" rev-parse --show-toplevel 2>/dev/null) ||
  fail "frontend directory is outside a Git checkout"
[ -f "$checkout/scripts/launch-task-board-mcp.sh" ] ||
  fail "expected the MeTravel frontend checkout"

worktrees=$(git -C "$checkout" worktree list --porcelain)
primary=$(printf '%s\n' "$worktrees" | sed -n '1s/^worktree //p')
[ -n "$primary" ] || fail "could not resolve the primary frontend checkout"

env_file="$checkout/.secrets/metravel-task-board.env"
if [ ! -f "$env_file" ]; then
  env_file="$primary/.secrets/metravel-task-board.env"
fi
[ -f "$env_file" ] && [ -r "$env_file" ] ||
  fail ".secrets/metravel-task-board.env is missing or unreadable in the active and primary frontend checkouts"

backend=${METRAVEL_TASK_BOARD_BACKEND_DIR:-"$primary/../metravel-backend"}
[ -f "$backend/tools/mcp_server/__main__.py" ] ||
  fail "MCP module missing in the backend checkout. Set METRAVEL_TASK_BOARD_BACKEND_DIR to its absolute path if it is not next to the primary frontend checkout"
backend=$(cd "$backend" && pwd -P)
command -v python3 >/dev/null 2>&1 || fail "python3 is unavailable"

if [ "$check" = true ]; then
  printf 'metravel-task-board: launcher prerequisites available\n' >&2
  exit 0
fi

unset METRAVEL_TASK_BOARD_API_TOKEN METRAVEL_TASK_BOARD_BASE_URL
set -a
. "$env_file" >/dev/null
set +a
[ -n "${METRAVEL_TASK_BOARD_API_TOKEN:-}" ] && [ -n "${METRAVEL_TASK_BOARD_BASE_URL:-}" ] ||
  fail "task-board API token and base URL must both be set in the env file"
cd "$backend"
export PYTHONPATH="$backend"
exec python3 -m tools.mcp_server
