#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

previous_root="${1:-}"
fresh_root="${2:-}"
retention_days="${3:-${EXPO_OVERLAY_RETENTION_DAYS:-14}}"

if [[ -z "$previous_root" || -z "$fresh_root" ]]; then
  echo "usage: deploy-expo-overlay.sh <previous-root> <fresh-root> [retention-days]" >&2
  exit 2
fi

if [[ ! "$retention_days" =~ ^[1-9][0-9]*$ ]]; then
  echo "EXPO_OVERLAY_RETENTION_DAYS must be a positive integer" >&2
  exit 2
fi

previous_static="$previous_root/_expo/static"
fresh_static="$fresh_root/_expo/static"

if [[ ! -d "$previous_static" ]]; then
  exit 0
fi

mkdir -p "$fresh_static"

overlay_manifest="$(mktemp "${TMPDIR:-/tmp}/metravel-expo-overlay.XXXXXX")"
trap 'rm -f "$overlay_manifest"' EXIT

find "$previous_static" -type f \
  \( \( -path '*/js/*' -name '*.js' \) -o \( -path '*/css/*' -name '*.css' \) \) \
  ! -mtime +"$retention_days" -print0 > "$overlay_manifest"

# Keep only recent hashed JS/CSS that are missing from the fresh payload. The
# NUL-delimited loop is intentional: Expo chunk paths may contain whitespace or
# shell metacharacters, and no prior-generation file may overwrite a new build.
while IFS= read -r -d '' previous_file; do
  relative_path="${previous_file#"$previous_root"/}"
  fresh_file="$fresh_root/$relative_path"

  if [[ -e "$fresh_file" || -L "$fresh_file" ]]; then
    continue
  fi

  mkdir -p "${fresh_file%/*}"
  cp -pn "$previous_file" "$fresh_file"
done < "$overlay_manifest"

# Do not reproduce empty directories from an expired/empty prior generation.
find "$fresh_static" -type d -empty -delete 2>/dev/null || true
