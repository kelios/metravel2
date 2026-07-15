#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_AAB="$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab"

usage() {
  cat <<'EOF'
Usage: ./scripts/android-submit.sh [--commit] [--aab PATH]

Uploads the local AAB to a temporary Google Play production edit. Without
--commit the edit is validated and deleted. With --commit it is published to
production. Closed/open/internal testing tracks are never modified.
EOF
}

commit=false
aab_path="$DEFAULT_AAB"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit)
      commit=true
      shift
      ;;
    --aab)
      [[ $# -ge 2 ]] || { usage >&2; exit 2; }
      aab_path="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      printf '[android-submit] ERROR: unsupported argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

[[ -f "$aab_path" ]] || {
  printf '[android-submit] ERROR: AAB not found: %s\n' "$aab_path" >&2
  exit 1
}

args=(upload-production --aab "$aab_path")
if [[ "$commit" == "true" ]]; then
  args+=(--commit)
else
  printf '[android-submit] Dry run: the production edit will be validated and deleted.\n'
fi

cd "$ROOT_DIR"
exec node scripts/android-play-release.js "${args[@]}"
