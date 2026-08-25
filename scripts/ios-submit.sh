#!/usr/bin/env bash

set -euo pipefail

readonly EAS_CLI_VERSION='21.8.0'
readonly BUILD_ID="${1:-}"
readonly ASC_APP_ID="${IOS_ASC_APP_ID:-}"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly SUBMIT_RUNTIME_PARENT="${PROJECT_ROOT}/.codex-temp"
unset IOS_ASC_APP_ID

if [[ ! "$BUILD_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
  echo 'Usage: IOS_UPLOAD_AUTHORIZATION=1 IOS_ASC_APP_ID=<protected-id> scripts/ios-submit.sh EAS_BUILD_UUID' >&2
  exit 2
fi
if [[ "$(git -C "$PROJECT_ROOT" branch --show-current)" != 'main' ]] ||
   [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal)" ]]; then
  echo 'Refusing App Store Connect upload outside a clean canonical main source state.' >&2
  exit 2
fi
readonly SOURCE_REVISION="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"

if [[ "${IOS_UPLOAD_AUTHORIZATION:-}" != '1' ]]; then
  echo 'Refusing App Store Connect upload without IOS_UPLOAD_AUTHORIZATION=1 from the explicit owner-authorized operation.' >&2
  exit 2
fi
if [[ ! "$ASC_APP_ID" =~ ^[0-9]{8,20}$ ]]; then
  echo 'Refusing App Store Connect upload without a valid protected IOS_ASC_APP_ID.' >&2
  exit 2
fi

cd "$PROJECT_ROOT"
node scripts/ios-release-guard.js

mkdir -p "$SUBMIT_RUNTIME_PARENT"
umask 077
SUBMIT_RUNTIME_DIR="$(mktemp -d "${SUBMIT_RUNTIME_PARENT}/ios-submit-runtime.XXXXXX")"
readonly BUILD_METADATA_PATH="${SUBMIT_RUNTIME_DIR}/eas-build.json"
readonly IPA_PATH="${SUBMIT_RUNTIME_DIR}/candidate.ipa"

cleanup() {
  case "$SUBMIT_RUNTIME_DIR" in
    "${SUBMIT_RUNTIME_PARENT}"/ios-submit-runtime.*)
      rm -rf -- "$SUBMIT_RUNTIME_DIR"
      ;;
    *)
      echo 'Refusing to remove an unexpected iOS submit runtime path.' >&2
      ;;
  esac
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Resolve and inspect the exact EAS artifact before App Store Connect sees it.
# The metadata and signed download URL stay in the ignored, mode-0700 runtime
# directory and are removed on exit.
npx --yes "eas-cli@${EAS_CLI_VERSION}" build:view "$BUILD_ID" --json > "$BUILD_METADATA_PATH"
node scripts/ios-eas-artifact-download.js "$BUILD_ID" "$BUILD_METADATA_PATH" "$IPA_PATH"
node scripts/ios-artifact-audit.js "$IPA_PATH"

if [[ "$(git -C "$PROJECT_ROOT" rev-parse HEAD)" != "$SOURCE_REVISION" ]] ||
   [[ "$(git -C "$PROJECT_ROOT" branch --show-current)" != 'main' ]] ||
   [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal)" ]]; then
  echo 'Refusing App Store Connect upload because the canonical source changed during artifact audit.' >&2
  exit 2
fi

for config_file in app.json app.config.js eas.json package.json yarn.lock; do
  cp "${PROJECT_ROOT}/${config_file}" "${SUBMIT_RUNTIME_DIR}/${config_file}"
done
for project_directory in node_modules plugins assets ios; do
  ln -s "${PROJECT_ROOT}/${project_directory}" "${SUBMIT_RUNTIME_DIR}/${project_directory}"
done

IOS_ASC_APP_ID="$ASC_APP_ID" node - "$SUBMIT_RUNTIME_DIR/eas.json" <<'NODE'
const fs = require('fs');

const configPath = process.argv[2];
const ascAppId = String(process.env.IOS_ASC_APP_ID || '').trim();
if (!/^\d{8,20}$/.test(ascAppId)) {
  throw new Error('Invalid protected IOS_ASC_APP_ID');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const iosSubmit = config.submit?.production?.ios;
if (!iosSubmit || iosSubmit.bundleIdentifier !== 'by.metravel.app') {
  throw new Error('Unexpected iOS production submit profile');
}
iosSubmit.ascAppId = ascAppId;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
NODE

cd "$SUBMIT_RUNTIME_DIR"

# Upload only. The App Store Connect app identifier is injected into an ignored,
# permission-restricted runtime config and removed after this command exits.
# EAS resolves the protected credential configured for this bundle under #1410.
# This never builds, submits for App Review, or releases a storefront version.
npx --yes "eas-cli@${EAS_CLI_VERSION}" submit --platform ios --profile production --id "$BUILD_ID" --non-interactive
