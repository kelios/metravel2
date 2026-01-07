#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "[security-check] FAIL: $1" >&2
  exit 1
}

warn() {
  echo "[security-check] WARN: $1" >&2
}

echo "[security-check] Running offline security config verification..."

# 1) lockfile policy
[[ -f yarn.lock ]] || fail "yarn.lock not found (expected yarn lockfile)"
if [[ -f package-lock.json ]]; then
  warn "package-lock.json found. Prefer a single package manager/lockfile for reproducible builds."
fi

# 2) packageManager pin
if ! grep -q '"packageManager"' package.json; then
  warn "packageManager is not pinned in package.json"
fi

# 3) overrides/resolutions
# Yarn v1 uses "resolutions" (npm uses "overrides"). For reproducible prod builds, we expect resolutions.
if ! grep -q '"resolutions"' package.json; then
  warn "yarn resolutions not configured (package.json resolutions)"
fi

# 4) patch-package safety
if grep -q 'patch-package' package.json; then
  if [[ ! -d patches ]]; then
    fail "patch-package is enabled but patches/ directory is missing"
  fi
fi

# 5) quick denylist grep (best-effort, offline)
# These checks are heuristic. They catch known-bad ranges that often trigger high/critical audits.
# If they fire, you should run: npm audit --audit-level=high

LOCK=yarn.lock

# minimist < 1.2.8
if awk '
  $0 ~ /^minimist@/ { inPkg=1; next }
  inPkg && $1=="version" {
    v=$2; gsub(/\"/,"",v);
    if (v ~ /^1\.2\.[0-7]$/) exit 1;
    inPkg=0;
  }
  inPkg && NF==0 { inPkg=0 }
  END { exit 0 }
' "$LOCK"; then
  :
else
  fail "Detected minimist < 1.2.8 in lockfile"
fi

# semver < 7.5.4 (common advisory family)
if awk '
  $0 ~ /^semver@/ { inPkg=1; next }
  inPkg && $1=="version" {
    v=$2; gsub(/\"/,"",v);
    if (v ~ /^7\.[0-4]\./) exit 1;
    inPkg=0;
  }
  inPkg && NF==0 { inPkg=0 }
  END { exit 0 }
' "$LOCK"; then
  :
else
  fail "Detected semver < 7.5.x in lockfile"
fi

# glob < 9 (glob 7/8 had multiple issues historically)
if awk '
  $0 ~ /^glob@/ { inPkg=1; next }
  inPkg && $1=="version" {
    v=$2; gsub(/\"/,"",v);
    if (v ~ /^[0-8]\./) exit 1;
    inPkg=0;
  }
  inPkg && NF==0 { inPkg=0 }
  END { exit 0 }
' "$LOCK"; then
  :
else
  warn "Detected glob < 9 in lockfile (may be ok, but often flagged). Consider relying on npm overrides."
fi

# follow-redirects < 1.15.6
if awk '
  $0 ~ /^follow-redirects@/ { inPkg=1; next }
  inPkg && $1=="version" {
    v=$2; gsub(/\"/,"",v);
    if (v ~ /^1\.15\.[0-5]$/) exit 1;
    inPkg=0;
  }
  inPkg && NF==0 { inPkg=0 }
  END { exit 0 }
' "$LOCK"; then
  :
else
  fail "Detected follow-redirects < 1.15.6 in lockfile"
fi

echo "[security-check] OK"

