#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_AAB="$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab"

usage() {
  cat <<'EOF'
Usage: ./scripts/android-submit-testing.sh [--commit] [--aab PATH]

Uploads the local AAB to a temporary Google Play edit that updates exactly the
alpha (closed testing) and internal tracks. Without --commit the edit is
validated and deleted. Production, beta, testers and countries are untouched.
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
      printf '[android-submit-testing] ERROR: unsupported argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

[[ -f "$aab_path" ]] || {
  printf '[android-submit-testing] ERROR: AAB not found: %s\n' "$aab_path" >&2
  exit 1
}

args=(upload-testing --aab "$aab_path")
if [[ "$commit" == "true" ]]; then
  args+=(--commit)
else
  printf '[android-submit-testing] Dry run: alpha/internal edit will be validated and deleted.\n'
fi

cd "$ROOT_DIR"
exec node scripts/android-play-testing-release.js "${args[@]}"
