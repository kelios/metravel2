#!/usr/bin/env bash

set -euo pipefail

readonly EAS_CLI_VERSION='21.8.0'
readonly PROFILE="${1:-}"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

if [[ "$(git -C "$PROJECT_ROOT" branch --show-current)" != 'main' ]] ||
   [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal)" ]]; then
  echo 'Refusing iOS build outside a clean canonical main source state.' >&2
  exit 2
fi

cd "$PROJECT_ROOT"

case "$PROFILE" in
  development)
    ;;
  preview|production)
    if [[ "${IOS_SIGNED_BUILD_AUTHORIZATION:-}" != '1' ]]; then
      echo "Refusing signed ${PROFILE} build: set IOS_SIGNED_BUILD_AUTHORIZATION=1 only after explicit owner authorization." >&2
      exit 2
    fi
    ;;
  *)
    echo 'Usage: scripts/ios-build.sh development|preview|production' >&2
    exit 2
    ;;
esac

node scripts/ios-release-guard.js

# Build only. Upload is intentionally a separate, explicitly authorized command.
exec npx --yes "eas-cli@${EAS_CLI_VERSION}" build --platform ios --profile "$PROFILE"
