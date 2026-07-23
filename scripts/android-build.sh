#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: ./scripts/android-build.sh <debug|production>

  debug       Build a local debug APK. Does not use EAS/Expo cloud credits.
  production  Build a signed local AAB for Google Play from the portable
              gitignored .secrets bundle (or explicit environment variables).
EOF
}

mode="${1:-production}"
case "$mode" in
  debug|production) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    printf '[android-build] ERROR: unsupported build mode: %s\n' "$mode" >&2
    exit 2
    ;;
esac

exec node "$ROOT_DIR/scripts/android-release-agent.js" "$mode"
