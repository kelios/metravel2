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
[[ -f package-lock.json ]] || fail "package-lock.json not found (expected npm lockfile)"
if [[ -f yarn.lock ]]; then
  warn "yarn.lock found. Prefer a single package manager/lockfile for reproducible builds."
fi

# 2) packageManager pin
if ! grep -q '"packageManager"' package.json; then
  warn "packageManager is not pinned in package.json"
fi

# 3) overrides/resolutions
if ! grep -q '"overrides"' package.json; then
  warn "npm overrides not configured (package.json overrides)"
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

LOCK=package-lock.json

# minimist < 1.2.8
if grep -q '"name": "minimist"\s*,\s*"version": "1\.2\.[0-7]"' "$LOCK"; then
  fail "Detected minimist < 1.2.8 in lockfile"
fi

# semver < 7.5.4 (common advisory family)
if grep -q '"name": "semver"\s*,\s*"version": "7\.[0-4]\.' "$LOCK"; then
  fail "Detected semver < 7.5.x in lockfile"
fi

# glob < 9 (glob 7/8 had multiple issues historically)
if grep -q '"name": "glob"\s*,\s*"version": "[0-8]\.' "$LOCK"; then
  warn "Detected glob < 9 in lockfile (may be ok, but often flagged). Consider relying on npm overrides."
fi

# follow-redirects < 1.15.6
if grep -q '"name": "follow-redirects"\s*,\s*"version": "1\.15\.[0-5]"' "$LOCK"; then
  fail "Detected follow-redirects < 1.15.6 in lockfile"
fi

echo "[security-check] OK"

