#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

fresh_root="${1:-}"
previous_root="${2:-}"
retention_days="${3:-14}"

if [[ -z "$fresh_root" || -z "$previous_root" ]]; then
  echo "Usage: deploy-expo-overlay.sh <fresh-static-root> <previous-static-root> [retention-days]" >&2
  exit 2
fi

if [[ ! "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "ERROR: retention-days must be a non-negative integer" >&2
  exit 2
fi

mkdir -p "$fresh_root"

# Retention age is the age of a deployed generation, not the source mtime of a
# cached build artifact. Expo can reuse hashed chunks without rewriting them,
# so a file shipped by the current payload may otherwise look older than the
# retention window and disappear on the very next deploy while an open tab is
# still using it. Stamp every current JS/CSS asset at publish time before the
# previous generation is overlaid; cp -p then carries that generation age
# through the supported overlap window.
find "$fresh_root" \
  -type f \
  \( -name '*.js' -o -name '*.css' \) \
  -exec touch -- {} +

[[ -d "$previous_root" ]] || exit 0

previous_prefix="${previous_root%/}/"

# Only hashed JS/CSS assets can be requested by an already-open HTML shell.
# The fresh payload is staged first, so skipping every existing destination
# makes the current release authoritative even when an old file has the same
# relative path. NUL-delimited find output keeps nested and unusual filenames
# safe, while the mtime filter prevents expired generations entering the stage.
find "$previous_root" \
  -type f \
  \( -name '*.js' -o -name '*.css' \) \
  ! -mtime "+$retention_days" \
  -print0 |
  while IFS= read -r -d '' previous_file; do
    relative_path="${previous_file#"$previous_prefix"}"
    fresh_file="$fresh_root/$relative_path"

    if [[ -e "$fresh_file" || -L "$fresh_file" ]]; then
      continue
    fi

    mkdir -p "$(dirname "$fresh_file")"
    cp -p "$previous_file" "$fresh_file"
  done
