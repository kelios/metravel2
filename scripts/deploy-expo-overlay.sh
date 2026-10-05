#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

fresh_root="${1:-}"
previous_root="${2:-}"
retention_days="${3:-14}"
budget_mb="${4:-}"

# Files stamped by one deploy share an mtime to within a touch pass, and two
# deploys are minutes apart; the window only has to tell those two cases apart.
generation_window_seconds=60

if [[ -z "$fresh_root" || -z "$previous_root" ]]; then
  echo "Usage: deploy-expo-overlay.sh <fresh-static-root> <previous-static-root> [retention-days] [budget-mb]" >&2
  exit 2
fi

if [[ ! "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "ERROR: retention-days must be a non-negative integer" >&2
  exit 2
fi

if [[ -n "$budget_mb" && ! "$budget_mb" =~ ^[0-9]+$ ]]; then
  echo "ERROR: budget-mb must be a non-negative integer or empty" >&2
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

# The selection below needs mtime and size of ~17 thousand files. perl gives
# one code path for GNU (prod host) and BSD (the macOS test run) userlands and
# one process instead of a `stat` per file on the single-core host.
if ! command -v perl >/dev/null 2>&1; then
  echo "ERROR: perl is required to select the Expo overlay generations" >&2
  exit 1
fi

# Physical path: bsdcpio refuses to extract through a symlinked prefix
# (`/var` -> `/private/var` on macOS) and still exits 0.
fresh_abs="$(cd "$fresh_root" && pwd -P)"
overlay_list="$(mktemp "${TMPDIR:-/tmp}/expo-overlay.XXXXXX")"
overlay_summary="$(mktemp "${TMPDIR:-/tmp}/expo-overlay-summary.XXXXXX")"
trap 'rm -f "$overlay_list" "$overlay_summary"' EXIT

# Only hashed JS/CSS assets can be requested by an already-open HTML shell.
# The fresh payload is staged first, so skipping every existing destination
# makes the current release authoritative even when an old file has the same
# relative path. NUL-delimited find output keeps nested and unusual filenames
# safe.
#
# The overlay is bounded twice. The age bound alone limits it in days, not in
# bytes: every deploy leaves ~10 MB of superseded chunks behind, so the tree
# grows with the deploy cadence (97 deploys inside one window held 943 MB on a
# 15 GB disk, #2186). The byte budget is the second bound.
#
# A tab needs every superseded chunk of its release, and those carry the stamp
# of that release or of a later one. So generations are taken whole and newest
# first, and the walk stops at the first generation that is too old or does
# not fit: an older one would be served only in part. The generation of the
# release being replaced is carried past both bounds — its tabs were opened
# seconds ago, however long ago that release was deployed. A tab older than
# the bounds reloads once on a missing chunk (utils/chunkReloadGuard.js).
#
# Age is counted like `find -mtime +N` on the prod host: whole days, so a
# generation leaves once it is N+1 days old.
#
# This helper itself arrives over `bash -s`, so perl takes its program from
# `-e` and its input from the pipe, never from the inherited stdin.
# shellcheck disable=SC2016
(cd "$previous_root" && find . \
  -type f \
  \( -name '*.js' -o -name '*.css' \) \
  -print0) |
  perl -e '
    use strict;
    use warnings;

    my ($previous, $fresh, $budget_mb, $window, $days, $summary_path) = @ARGV;
    local $/ = "\0";

    my $now = time;
    my $release_stamp = 0;
    my @candidates;
    while (defined(my $path = <STDIN>)) {
      chomp $path;
      $path =~ s{^\./}{};
      my @stat = lstat("$previous/$path") or next;
      my ($size, $mtime) = @stat[7, 9];
      $release_stamp = $mtime if $mtime > $release_stamp;
      next if -e "$fresh/$path" || -l "$fresh/$path";
      push @candidates, [$mtime, $size, $path];
    }

    my @generations;
    for my $file (sort { $b->[0] <=> $a->[0] || $a->[2] cmp $b->[2] } @candidates) {
      if (!@generations || $generations[-1]{stamp} - $file->[0] > $window) {
        push @generations, { stamp => $file->[0], bytes => 0, paths => [] };
      }
      $generations[-1]{bytes} += $file->[1];
      push @{ $generations[-1]{paths} }, $file->[2];
    }

    my $budget = $budget_mb eq q{} ? undef : $budget_mb * 1024 * 1024;
    my %kept = (generations => 0, files => 0, bytes => 0);
    my %dropped = (generations => 0, files => 0, bytes => 0);
    my $open = 1;
    for my $generation (@generations) {
      my $replaced_release = $release_stamp - $generation->{stamp} <= $window;
      my $expired = int(($now - $generation->{stamp}) / 86400) > $days;
      my $fits = !defined $budget
        || $kept{bytes} + $generation->{bytes} <= $budget;
      $open = 0 unless $replaced_release || (!$expired && $fits);
      my $bucket = $open ? \%kept : \%dropped;
      $bucket->{generations} += 1;
      $bucket->{files} += @{ $generation->{paths} };
      $bucket->{bytes} += $generation->{bytes};
      next unless $open;
      print "$_\0" for @{ $generation->{paths} };
    }
    # A list cut short by a full disk must not pass for a finished one.
    close(STDOUT) or die "cannot write the overlay list: $!\n";

    my $describe = sub {
      my ($bucket) = @_;
      return sprintf(
        "поколений %d, файлов %d, %.0f МБ",
        $bucket->{generations}, $bucket->{files}, $bucket->{bytes} / (1024 * 1024),
      );
    };
    open(my $summary, q{>}, $summary_path) or die "cannot write $summary_path: $!\n";
    printf {$summary} "📊 Overlay старых чанков: перенесено — %s; отброшено — %s (предел %s, срок %d дн.)\n",
      $describe->(\%kept), $describe->(\%dropped),
      defined $budget ? "$budget_mb МБ" : "не задан", $days;
    close($summary) or die "cannot write $summary_path: $!\n";
  ' "$previous_root" "$fresh_abs" "$budget_mb" "$generation_window_seconds" \
    "$retention_days" "$overlay_summary" > "$overlay_list"

if [[ -s "$overlay_list" ]]; then
  # One cpio pass instead of three processes per file (#2013): the overlap
  # window holds thousands of chunks on prod, and `dirname` + `mkdir -p` +
  # `cp -p` for each cost tens of seconds of the single-core host plus a second
  # copy of the overlay on a disk with ~2 GB free. `-l` hard-links the previous
  # generation's file (same volume; cpio copies when linking is impossible),
  # `-m` keeps its mtime — both retention bounds are counted from it — and `-d`
  # creates the directories. The list is filtered against the fresh payload
  # beforehand, so cpio never has to resolve a collision on its own.
  (cd "$previous_root" && cpio -0 -p -d -l -m --quiet "$fresh_abs" < "$overlay_list")

  # cpio reports some refusals on stderr only and still exits 0, so the
  # published set is checked explicitly: a missing chunk here would 404 an
  # open tab.
  while IFS= read -r -d '' relative_path; do
    if [[ ! -f "$fresh_abs/$relative_path" ]]; then
      echo "ERROR: overlay did not publish $relative_path" >&2
      exit 1
    fi
  done < "$overlay_list"
fi

# Printed last and only on success: the deploy report quotes this line as the
# evidence that both retention bounds were applied.
cat "$overlay_summary"
