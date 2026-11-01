#!/usr/bin/env bash

# Post-stage audit of one SSR release on the prod host. Shipped by
# scripts/web-ssr-publication.sh over `bash -s`, like deploy-disk-guard.sh, and
# run against `web-ssr/releases/<sha>/client` right after the backend helper
# has sealed the release (#2857).
#
#   web-ssr-release-audit.sh books <release-client> <store>
#       Ready books (`client/travel-books`) are immutable by revision and were
#       copied whole into every release: 226 MB uploaded and stored per deploy.
#       The publisher now uploads them with `--link-dest=<store>`, so an
#       unchanged book is a hard link into `web-ssr/shared/travel-books`. This
#       command links the books of the fresh release into the store (new
#       revisions, or the whole set on the first run) and drops every store
#       file no release references any more, then prints one report line. An
#       I/O failure or a symlinked store exits non-zero, so the deploy stops
#       before the swap like on the chunk limit below.
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

# A link count is not a reference count for the books: copy-publication.cjs
# hard-links equal content inside one build (the same font, preview or PDF
# across revisions), so most publication files are one inode with several
# paths in the release and in the store. Both questions below are therefore
# asked per inode, in perl — one code path for GNU (prod) and BSD (the macOS
# test run); the overlay helper already requires it on the host.
#
# Prints "<files>\t<bytes>": distinct files of the release books that share no
# inode with the store, i.e. what the upload had to bring. The pointer
# `manifest.json` changes with every build and is left out.
# shellcheck disable=SC2016
new_in_release() {
  perl -MFile::Find -e '
    use strict;
    use warnings;
    my ($release, $store) = @ARGV;
    my %stored;
    find({ no_chdir => 1, wanted => sub {
      my @stat = lstat $_ or return;
      $stored{"$stat[0]:$stat[1]"} = 1 if -f _;
    } }, $store);
    my %seen;
    my ($files, $bytes) = (0, 0);
    find({ no_chdir => 1, wanted => sub {
      return if $_ eq "$release/manifest.json";
      my @stat = lstat $_ or return;
      return unless -f _;
      my $inode = "$stat[0]:$stat[1]";
      return if $stored{$inode} || $seen{$inode}++;
      $files += 1;
      $bytes += $stat[7];
    } }, $release);
    print "$files\t$bytes\n";
  ' "$1" "$2" < /dev/null
}

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
  local new_files new_bytes counts files kib store_files store_kib

  if [[ ! -d "$release_books" ]]; then
    echo "📊 Книги релиза: в релизе нет каталога travel-books"
    return 0
  fi
  if [[ -L "$store" ]]; then
    echo "ERROR: the shared book store must not be a symlink" >&2
    return 1
  fi
  mkdir -p "$store"

  # Files the upload had to bring: nothing in the store shared their inode.
  counts="$(new_in_release "$release_books" "$store")"
  new_files="${counts%%$'\t'*}"
  new_bytes="${counts##*$'\t'}"

  # The pointer `manifest.json` changes with every build and is not an
  # immutable asset; everything else is content-addressed by revision. rsync
  # links what the store lacks and leaves identical entries alone.
  rsync -a --exclude=/manifest.json --link-dest="$release_books" "$release_books/" "$store/" < /dev/null

  # Unreferenced store files leave; their directories follow once empty.
  prune_store "$store"
  find "$store" -mindepth 1 -type d -empty -delete

  files="$(count_files "$release_books")"
  kib="$(kib_of "$release_books")"
  store_files="$(count_files "$store")"
  store_kib="$(kib_of "$store")"
  echo "📊 Книги релиза: ${files} файлов, $(to_mb "$kib") МБ, из них загружено заново ${new_files} ($(to_mb $(( (new_bytes + 1023) / 1024 ))) МБ), остальные — жёсткие ссылки в общее хранилище web-ssr/shared/travel-books (${store_files} файлов, $(to_mb "$store_kib") МБ)"
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
