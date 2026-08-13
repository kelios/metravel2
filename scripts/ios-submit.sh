#!/usr/bin/env bash

set -euo pipefail

readonly EAS_CLI_VERSION='21.8.0'
readonly BUILD_ID="${1:-}"

if [[ -z "$BUILD_ID" ]]; then
  echo 'Usage: IOS_UPLOAD_AUTHORIZATION=1 scripts/ios-submit.sh BUILD_ID' >&2
  exit 2
fi
if [[ "${IOS_UPLOAD_AUTHORIZATION:-}" != '1' ]]; then
  echo 'Refusing App Store Connect upload without IOS_UPLOAD_AUTHORIZATION=1 from the explicit owner-authorized operation.' >&2
  exit 2
fi

node scripts/ios-release-guard.js

# Upload only. EAS resolves the protected App Store Connect credential configured
# for this bundle under #1410; non-interactive mode fails closed if it is absent.
# This never builds, submits for App Review, or releases a storefront version.
exec npx --yes "eas-cli@${EAS_CLI_VERSION}" submit --platform ios --profile production --id "$BUILD_ID" --non-interactive
