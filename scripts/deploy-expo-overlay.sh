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
# previous generation is overlaid; the overlay then carries that generation age
# through the supported overlap window.
find "$fresh_root" \
  -type f \
  \( -name '*.js' -o -name '*.css' \) \
  -exec touch -- {} +

[[ -d "$previous_root" ]] || exit 0

# Physical path: bsdcpio refuses to extract through a symlinked prefix
# (`/var` -> `/private/var` on macOS) and still exits 0.
fresh_abs="$(cd "$fresh_root" && pwd -P)"
overlay_list="$(mktemp "${TMPDIR:-/tmp}/expo-overlay.XXXXXX")"
trap 'rm -f "$overlay_list"' EXIT

# Only hashed JS/CSS assets can be requested by an already-open HTML shell.
# The fresh payload is staged first, so skipping every existing destination
# makes the current release authoritative even when an old file has the same
# relative path. NUL-delimited find output keeps nested and unusual filenames
# safe, while the mtime filter prevents expired generations entering the stage.
#
# One cpio pass instead of three processes per file (#2013): the overlap window
# holds ~6 thousand chunks on prod, and `dirname` + `mkdir -p` + `cp -p` for
# each cost tens of seconds of the single-core host plus a second copy of
# ~420 MB on a disk with ~2 GB free. `-l` hard-links the previous generation's
# file (same volume; cpio copies when linking is impossible), `-m` keeps its
# mtime — the retention window is counted from it — and `-d` creates the
# directories. The list is filtered against the fresh payload beforehand, so
# cpio never has to resolve a collision on its own.
(cd "$previous_root" && find . \
  -type f \
  \( -name '*.js' -o -name '*.css' \) \
  ! -mtime "+$retention_days" \
  -print0) |
  while IFS= read -r -d '' relative_path; do
    relative_path="${relative_path#./}"
    if [[ -e "$fresh_abs/$relative_path" || -L "$fresh_abs/$relative_path" ]]; then
      continue
    fi
    printf '%s\0' "$relative_path"
  done > "$overlay_list"

[[ -s "$overlay_list" ]] || exit 0

(cd "$previous_root" && cpio -0 -p -d -l -m --quiet "$fresh_abs" < "$overlay_list")

# cpio reports some refusals on stderr only and still exits 0, so the published
# set is checked explicitly: a missing chunk here would 404 an open tab.
while IFS= read -r -d '' relative_path; do
  if [[ ! -f "$fresh_abs/$relative_path" ]]; then
    echo "ERROR: overlay did not publish $relative_path" >&2
    exit 1
  fi
done < "$overlay_list"
