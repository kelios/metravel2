#!/usr/bin/env bash

# Post-stage audit of one SSR release on the prod host. Shipped by
# scripts/web-ssr-publication.sh over `bash -s`, like deploy-disk-guard.sh, and
# run against `web-ssr/releases/<sha>/client` right after the backend helper
# has sealed the release (#2857).
#
#   web-ssr-release-audit.sh books <release-client> <store>
#       Ready-book files live in S3 (#2971); a release carries only the
#       pointer `client/travel-books/manifest.json`. Anything else there exits
#       1, so the deploy stops before the swap like on the chunk limit below.
#       Releases staged before #2971 still hold their books as hard links into
#       the former shared store `web-ssr/shared/travel-books` (#2857). Every
#       run drops the store files no release references any more (finalize
#       removed the last one) and the store itself once it is empty, then
#       prints one report line. A symlinked store exits non-zero.
#   web-ssr-release-audit.sh chunks <release-client> <fresh-js-kib> <overlay-max-mb> [max-mb]
#       `_expo/static/js` of a release is the fresh export plus the overlay of
#       previous generations (deploy-expo-overlay.sh). The backend runs the
#       overlay with its output captured, so this is the only place the size
#       of what was actually sealed is visible. Limit: twice the fresh export
#       (this release and the one it replaces, which is carried past the
#       overlay bounds by design) plus the overlay budget, or an explicit
#       `max-mb`. Exit 1 above the limit: the release is sealed but not
#       published yet, so the deploy stops before the swap.

set -Eeuo pipefail
IFS=$'\n\t'

runbook='docs/ops/prod-disk-growth.md'

usage() {
  echo "Usage: web-ssr-release-audit.sh books <release-client> <store>" >&2
  echo "       web-ssr-release-audit.sh chunks <release-client> <fresh-js-kib> <overlay-max-mb> [max-mb]" >&2
  exit 2
}

require_integer() {
  if [[ ! "$2" =~ ^[0-9]+$ ]]; then
    echo "ERROR: $1 must be a non-negative integer" >&2
    exit 2
  fi
}

kib_of() {
  local size
  size="$(du -sk "$1" 2>/dev/null | awk '{ print $1 }' || true)"
  echo "${size:-0}"
}

to_mb() { echo $(( ($1 + 1023) / 1024 )); }

# bash 3.2 (the macOS test run) joins forwarded positional slices under a
# custom IFS, so each predicate set is spelled out.
count_files() {
  find "$1" -type f | wc -l | tr -d ' '
}

count_js_files() {
  find "$1" -type f -name '*.js' | wc -l | tr -d ' '
}

# A link count is not a reference count for the books: the former
# copy-publication.cjs hard-linked equal content inside one build (the same
# font, preview or PDF across revisions), so most store files are one inode
# with several paths in a release and in the store. The question below is
# therefore asked per inode, in perl — one code path for GNU (prod) and BSD
# (the macOS test run); the overlay helper already requires it on the host.
# Drops every store inode whose links are all store paths: no release
# references it any more (finalize removed the last one).
# shellcheck disable=SC2016
prune_store() {
  perl -MFile::Find -e '
    use strict;
    use warnings;
    my (%paths, %links);
    find({ no_chdir => 1, wanted => sub {
      my @stat = lstat $_ or return;
      return unless -f _;
      my $inode = "$stat[0]:$stat[1]";
      push @{ $paths{$inode} }, $_;
      $links{$inode} = $stat[3];
    } }, $ARGV[0]);
    for my $inode (keys %paths) {
      my @paths = @{ $paths{$inode} };
      next if @paths < $links{$inode};
      unlink(@paths) == @paths or die "cannot prune the book store: $!\n";
    }
  ' "$1" < /dev/null
}

books() {
  local client="$1" store="$2"
  local release_books="$client/travel-books"
  local extra store_files store_kib

  if [[ -L "$store" ]]; then
    echo "ERROR: the shared book store must not be a symlink" >&2
    return 1
  fi
  if [[ -d "$release_books" ]]; then
    # awk reads to the end: `head` would SIGPIPE find under pipefail.
    extra="$(find "$release_books" -mindepth 1 ! -path "$release_books/manifest.json" | awk 'NR <= 5')"
    if [[ -n "$extra" ]]; then
      echo "❌ Релиз запечатан, но не опубликован: в client/travel-books кроме manifest.json есть файлы — книги хранятся в S3 (#2971), сборка их в релиз не кладёт:" >&2
      echo "$extra" >&2
      return 1
    fi
  fi

  if [[ -d "$store" ]]; then
    prune_store "$store"
    find "$store" -mindepth 1 -type d -empty -delete
    if [[ -z "$(find "$store" -mindepth 1 -print -quit)" ]]; then
      rmdir "$store"
    fi
  fi
  if [[ -d "$store" ]]; then
    store_files="$(count_files "$store")"
    store_kib="$(kib_of "$store")"
    echo "📊 Книги релиза: только manifest.json, файлы — в S3; прежнее хранилище web-ssr/shared/travel-books: ${store_files} файлов, $(to_mb "$store_kib") МБ — держат релизы до #2971, уходит вместе с ними из ретеншена"
  else
    echo "📊 Книги релиза: только manifest.json, файлы — в S3; прежнего хранилища web-ssr/shared/travel-books нет"
  fi
}

chunks() {
  local client="$1" fresh_kib="$2" overlay_mb="$3" max_mb="${4:-}"
  local js="$client/_expo/static/js"
  local files kib mb fresh_mb limit basis

  require_integer fresh-js-kib "$fresh_kib"
  require_integer overlay-max-mb "$overlay_mb"
  if [[ -n "$max_mb" ]]; then
    require_integer max-mb "$max_mb"
  fi
  if [[ ! -d "$js" ]]; then
    echo "ERROR: $js is missing" >&2
    return 1
  fi

  files="$(count_js_files "$js")"
  kib="$(kib_of "$js")"
  mb="$(to_mb "$kib")"
  fresh_mb="$(to_mb "$fresh_kib")"
  if [[ -n "$max_mb" ]]; then
    limit="$max_mb"
    basis="задан явно"
  else
    limit=$(( 2 * fresh_mb + overlay_mb ))
    basis="2 × свежий экспорт + overlay ${overlay_mb} МБ"
  fi

  echo "📊 Чанки релиза на проде: ${files} js-файлов, ${mb} МБ в _expo/static/js (свежий экспорт ${fresh_mb} МБ, предел ${limit} МБ: ${basis})"
  if (( mb > limit )); then
    echo "❌ Релиз запечатан, но не опубликован: _expo/static/js занял ${mb} МБ при пределе ${limit} МБ — overlay прошлых поколений переносится без границ. Механизм и порядок действий — $runbook"
    return 1
  fi
}

case "${1:-}" in
  books)
    [[ $# -eq 3 ]] || usage
    books "$2" "$3"
    ;;
  chunks)
    [[ $# -eq 4 || $# -eq 5 ]] || usage
    chunks "$2" "$3" "$4" "${5:-}"
    ;;
  *)
    usage
    ;;
esac
