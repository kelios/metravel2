#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_DIR="$ROOT_DIR/.codex-temp/ops/android-local-build.lock"
DEFAULT_KEYSTORE_PATH="$ROOT_DIR/.secrets/metravel-android-upload.jks"
KEYCHAIN_STORE_SERVICE="metravel-android-upload-store-password"
KEYCHAIN_KEY_SERVICE="metravel-android-upload-key-password"
KEY_ALIAS="metravel-upload"

usage() {
  cat <<'EOF'
Usage: ./scripts/android-build.sh <debug|production>

  debug       Build a local debug APK. Does not use EAS/Expo cloud credits.
  production  Build a signed local AAB for Google Play. Requires the four
              METRAVEL_ANDROID_KEYSTORE_* environment variables.
EOF
}

fail() {
  printf '[android-build] ERROR: %s\n' "$*" >&2
  exit 1
}

acquire_lock() {
  mkdir -p "$(dirname "$LOCK_DIR")"
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_DIR/pid"
    return
  fi

  local owner_pid=""
  if [[ -f "$LOCK_DIR/pid" ]]; then
    owner_pid="$(tr -dc '0-9' < "$LOCK_DIR/pid")"
  fi
  if [[ -n "$owner_pid" ]] && kill -0 "$owner_pid" 2>/dev/null; then
    fail "another Android local build is active (PID $owner_pid)"
  fi

  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
}

cleanup() {
  rm -rf "$LOCK_DIR"
}

require_release_signing() {
  local name
  for name in \
    METRAVEL_ANDROID_KEYSTORE_PATH \
    METRAVEL_ANDROID_KEYSTORE_PASSWORD \
    METRAVEL_ANDROID_KEY_ALIAS \
    METRAVEL_ANDROID_KEY_PASSWORD; do
    [[ -n "${!name:-}" ]] || fail "$name is required for a production AAB"
  done

  local keystore_path="$METRAVEL_ANDROID_KEYSTORE_PATH"
  if [[ "$keystore_path" != /* ]]; then
    keystore_path="$ROOT_DIR/$keystore_path"
  fi
  [[ -f "$keystore_path" ]] || fail "release keystore file does not exist"
}

load_macos_keychain_signing() {
  if [[ -n "${METRAVEL_ANDROID_KEYSTORE_PATH:-}" ]] &&
    [[ -n "${METRAVEL_ANDROID_KEYSTORE_PASSWORD:-}" ]] &&
    [[ -n "${METRAVEL_ANDROID_KEY_ALIAS:-}" ]] &&
    [[ -n "${METRAVEL_ANDROID_KEY_PASSWORD:-}" ]]; then
    return
  fi

  [[ "$(uname -s)" == "Darwin" ]] || return
  command -v security >/dev/null 2>&1 || return
  [[ -f "$DEFAULT_KEYSTORE_PATH" ]] || return

  local store_password
  local key_password
  store_password="$(security find-generic-password -a "$USER" -s "$KEYCHAIN_STORE_SERVICE" -w 2>/dev/null)" || return
  key_password="$(security find-generic-password -a "$USER" -s "$KEYCHAIN_KEY_SERVICE" -w 2>/dev/null)" || return

  export METRAVEL_ANDROID_KEYSTORE_PATH="$DEFAULT_KEYSTORE_PATH"
  export METRAVEL_ANDROID_KEYSTORE_PASSWORD="$store_password"
  export METRAVEL_ANDROID_KEY_ALIAS="$KEY_ALIAS"
  export METRAVEL_ANDROID_KEY_PASSWORD="$key_password"
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
    fail "unsupported build mode: $mode"
    ;;
esac

command -v node >/dev/null 2>&1 || fail "Node.js is required"
[[ -x "$ROOT_DIR/android/gradlew" ]] || fail "android/gradlew is missing or not executable"

acquire_lock
trap cleanup EXIT INT TERM

if [[ "$mode" == "debug" ]]; then
  printf '[android-build] Building local debug APK (no EAS cloud)…\n'
  node "$ROOT_DIR/scripts/android-gradle-build.js" debug
  printf '[android-build] Artifact: %s\n' "$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
  exit 0
fi

load_macos_keychain_signing
require_release_signing
printf '[android-build] Building signed local production AAB (no EAS cloud)…\n'
node "$ROOT_DIR/scripts/android-gradle-build.js" production
printf '[android-build] Artifact: %s\n' "$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab"
