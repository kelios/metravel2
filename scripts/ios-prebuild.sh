#!/usr/bin/env bash

set -euo pipefail

# Tracked native iOS files are canonical. Never run a destructive clean/prebuild here.
node scripts/ios-environment-preflight.js
node scripts/ios-release-guard.js
echo 'Tracked iOS release configuration is ready; no native files were regenerated.'
