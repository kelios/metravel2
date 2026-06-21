#!/usr/bin/env node
/*
 * Prints a fresh API Token to stdout by logging in the QA e2e account
 * (programmatic login → Token, per CLAUDE.md). Use this when ~/.metravel_token
 * is stale/invalid (HTTP 401) before applying quest patches.
 *
 * Credentials come from env (E2E_EMAIL / E2E_PASSWORD) or, if absent, from the
 * gitignored .env.e2e file. The password is never printed or logged — ONLY the
 * token is written to stdout, so it can be captured into an env var:
 *
 *   METRAVEL_TOKEN=$(node scripts/get-quest-token.js) \
 *     node scripts/apply-quest-patches.js .quest-audit/patches-geo-*.json
 *
 * (Pass the token via env, not --token=, so it does not show up in `ps`.)
 *
 * Options: --api-url=<base> (default https://metravel.by), --env-file=<path>.
 */

const fs = require('fs');
const path = require('path');

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

async function main() {
  const apiUrl = getArg('api-url', 'https://metravel.by').replace(/\/+$/, '');
  const envFile = path.resolve(process.cwd(), getArg('env-file', '.env.e2e'));
  const fromFile = readEnvFile(envFile);
  const email = process.env.E2E_EMAIL || fromFile.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD || fromFile.E2E_PASSWORD;

  if (!email || !password) {
    console.error(`get-quest-token: missing E2E_EMAIL/E2E_PASSWORD (env or ${envFile})`);
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/api/user/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.token) {
    // Never echo the password; surface only the status + a generic reason.
    console.error(`get-quest-token: login failed (HTTP ${res.status})`);
    process.exit(1);
  }
  // ONLY the token to stdout.
  process.stdout.write(json.token);
}

main().catch((error) => {
  console.error(`get-quest-token: ${error.message || error}`);
  process.exit(1);
});
