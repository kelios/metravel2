#!/usr/bin/env bash
# Installed-app XCTest driver. Explicit IOS_QA_DEVICE; JSON or @tracked-scenario.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec node "$ROOT/run.js" "$@"
