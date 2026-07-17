# Release / deployment guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Production checkout immutability

- Frontend release automation may mutate only its documented untracked
  runtime/static targets, such as `static/dist`, `static/dist.new`, and
  `static/dist.bak`.
- Before an authorized server write, inspect the backend checkout with
  `git status --short` and classify every intended path using
  `git ls-files --error-unmatch -- <repo-relative-path>`. Never patch, overwrite, copy, move,
  delete, chmod, or create an in-checkout backup for a tracked path.
- This frontend workspace never runs backend `commit`, `push`, `pull`, `merge`,
  `rebase`, `checkout`, `reset`, `restore`, `stash`, or `clean` locally or in
  production. Backend source/config changes belong to the backend owner's
  canonical commit/review/deploy flow.
- A dirty production checkout is a stop condition for a mutating deploy: collect
  a secret-safe path/diff summary, create or update an `area=back`/ops task, and
  leave the checkout untouched for its owner. The only frontend-deploy gate
  exceptions are the known untracked `deploy/prod/nginx/ssl/`, untracked
  `dump.sql`, and the permission warning for `deploy/prod/postgis_1/data/`.
  Do not inspect or mutate those paths; any other status entry or warning still
  stops the deploy. See the canonical rule in `docs/RULES.md`.

## One-command pre-release check

```bash
npm run release:check
```

It runs:

- `npm run lint`
- `npm run typecheck`
- `./verify-security-fixes.sh`
- `npm run audit:high`
- `npm run test:run`
- `npm run e2e`
- `npm run build:web:prod`
- `npm run guard:eager-web:fail`
- `npm run guard:bundle-budget:fail`

Notes:
- `npm run lint` includes `npm run guard:external-links`.
- For policy integrity checks, run `npm run governance:verify`.
- Canonical governance command reference: `docs/TESTING.md#governance-commands`.

## Web build

```bash
npm run build:web:prod
```

(Production web export + SEO page generation + travel SEO validation)

### Prod deploy script

```bash
./build-prod.sh prod
```

- Accepts env argument: `dev`, `preprod`, `prod` (default: `prod`).
- Pipeline: applies `.env.<env>` -> builds `dist/<env>` -> runs SEO/public post-processing -> deploys to server.
- The script is the normal production deploy path on machines with working `rsync`. It runs the canonical build and static SEO guards, uploads `dist/`, atomically swaps `static/dist`, overlays missing old Expo chunks for open tabs, restarts `app` + `nginx`, and runs post-deploy SEO checks.
- Its server writes are limited to the documented untracked static targets. It
  must stop rather than modify or clean a Git-tracked backend path.
- Build without deploy:

```bash
DEPLOY=0 ./build-prod.sh prod
```

### Deploy transport depends on the machine: check `rsync` first

The deploy step of `./build-prod.sh prod` uploads over `rsync`, and that transport is not reliable
everywhere. Before a production deploy, establish which machine you are on:

```bash
rsync --version | head -1   # need GNU rsync, protocol >= 30
```

**macOS (current workstation) — normal path.** Homebrew rsync (`/opt/homebrew/bin/rsync`, 3.4.4 /
protocol 32) is first in `PATH` and uploads the full artifact; deploys on 2026-07-04 and 2026-07-17
both transferred completely. Use `./build-prod.sh prod` as documented above.

Do **not** deploy with the macOS system `openrsync` (`/usr/bin/rsync`, protocol 29). Against the
server's GNU rsync it silently transfers an incomplete archive (~36MB instead of ~150MB, missing the
JS bundles and `index.html`) and breaks production. If it is first in `PATH`, install GNU rsync
(`brew install rsync`) or upload with `tar+ssh` — never continue silently.

**Windows/Codex machine (`D:\metravel\metravel2`) — historical, not this checkout.** There the
Git-for-Windows/MSYS2 `rsync` transport fails outright and e2e/preflight processes clobber `dist/`,
so deploys went through an ops wrapper:

```bash
bash /d/metravel/ops/deploy-frontend.sh
```

It verified branch `main`, SSH access and operation safety, ran `DEPLOY=0 bash ./build-prod.sh prod`,
checked `dist/prod`, uploaded with `tar+ssh`, atomically swapped `static/dist`, overlaid old Expo
chunks, restarted `app` and `nginx`, ran health checks, and rolled back automatically from
`static/dist.bak` on failure. This wrapper does not exist on the macOS checkout — do not look for it.

Do not launch a deploy while another build/deploy/e2e operation owns the corresponding lock or
target, and do not kill another session's process to make room.

Manual rollback command if a deploy reports broken production:

```bash
ssh sx3@178.172.137.129 'cd /home/sx3/metravel && mv static/dist static/dist.broken && mv static/dist.bak static/dist && docker compose -f docker-compose-prod.app.yaml restart nginx'
```

### SSH access to prod

The server is `sx3@178.172.137.129` (`/home/sx3/metravel`) — the default already baked into the
deploy scripts (`SERVER="${SERVER:-sx3@178.172.137.129}"`), so leave it unset and it just works.

The `metravel-prod` host alias exists only on machines whose `~/.ssh/config` defines it; the macOS
checkout has an entry for `github.com` only. **A missing alias does not mean missing access** — the
key is served from ssh-agent (`~/.ssh/id_ed25519` on macOS, accepted by the server). Probe access by
direct host, not by alias:

```bash
ssh sx3@178.172.137.129 "echo ok"
```

### Emergency frontend redeploy

`scripts/fix-prod.sh` is a recovery path for production web static assets, not the default release command.
Use it only when the user explicitly asks for emergency frontend recovery or the normal deploy path is
unavailable and the reason is recorded in the handoff.

The script acquires a remote deploy lock, can rebuild `dist/prod`, verifies the prod artifact config,
uploads static assets, performs an in-container atomic swap, overlays missing old Expo chunks, restarts
nginx, validates live chunks/config, and fails closed on wrong prod config. Do not replace the normal
`./build-prod.sh prod` or Windows/Codex wrapper flow with custom `rsync`, `scp`, or SSH deploy commands.

## Post-deploy SEO check

Run after production deploy against the real URL:

```bash
npm run test:seo:postdeploy
```

Verbose mode:

```bash
npm run test:seo:postdeploy:verbose
```

What it checks:
- sitemap pages + key non-sitemap routes
- raw HTML `title`, `description`, `canonical`
- `og:*` and `twitter:*`
- `robots`
- travel page SSR `H1` and `Article` JSON-LD
- home mobile icons and `manifest.json`

Sitemap ownership:
- Production `sitemap.xml` is generated by the backend.
- Frontend release/build scripts must not generate or overwrite production sitemap files.
- If sitemap contents are wrong, fix the backend generator or backend deploy configuration, then verify with `npm run test:seo:postdeploy`.

## Mobile travel Lighthouse budget guard

Runtime-metric regression tripwire for the mobile travel-details page, complementing
the byte-level guards (`guard:bundle-budget`, `guard:eager-web`) that gate `release:check`.

- Guard: `scripts/guard-lighthouse-mobile-budget.js` (npm `guard:lighthouse:mobile` / `:fail`).
- Budget: `config/lighthouse-budget-mobile.json` (score ≥ 60, LCP ≤ 4000ms, CLS ≤ 0.1, TBT ≤ 600ms, FCP ≤ 3000ms).
- The guard is **report-consuming and deterministic**; its fixture self-test runs
  inside `test:run` and therefore inside `release:check`.

Required post-deploy gate (environment-dependent, not wired as a release blocker):

```bash
npm run lighthouse:produrl:travel:mobile -- --url https://metravel.by/travels/<slug>
npm run guard:lighthouse:mobile:fail   # reads ./lighthouse-report.produrl.mobile.json
```

- Produce the report with the throttling method required by
  `config/lighthouse-budget-mobile.json`; the config, not historical measurements in
  documentation, owns metric thresholds and method.
- Fresh Lighthouse evidence is a post-deploy gate. Byte guards remain part of
  `release:check`; neither substitutes for the other.

## Web cache policy (do not revert)

- Service Worker caching for web is disabled by policy.
- Never require users to manually clear browser cache after deploy.
- Any change that re-enables SW runtime/static cache or adds "clear cache" UX is prohibited.

## Mobile builds

See scripts in `package.json`:

Android release contract:

- Android EAS/cloud build and submit are disabled. Do not use an EAS Android or
  `--platform all` command.
- Android QA uses a locally built app installed over USB. Production uses a
  locally signed Gradle AAB and the project-owned Google Play API client.
- `alpha`, `internal`, `beta`, tester/country settings and the active closed test
  are protected from this production release path.

### iOS (inactive)

iOS/iPadOS-приложения пока нет. Эти команды сохранены только как future
scaffolding reference и не входят в обычные release checks, QA или Done gate.
Запуск возможен только после нового явного решения пользователя вернуть iOS в scope.

```bash
npm run ios:prebuild
npm run ios:build:prod
npm run ios:submit:latest
```

### Android

```bash
npm run android:prebuild
npm run android:build:prod
npm run android:submit:latest       # validate temporary production edit, no commit
npm run android:submit:production   # commit production edit
npm run android:play:status         # temporary read-only edit, then delete
```

## Secrets / credentials

See `PRODUCTION_CHECKLIST.md`.

- Do not commit production secrets into `.env.*`.
- iOS cloud secrets относятся только к неактивному future path и не нужны для
  текущих web/Android release checks.
- Keep Android upload-keystore credentials in the local secret store as the four
  `METRAVEL_ANDROID_KEYSTORE_*` variables. Keep the Google Play service-account
  key gitignored; never print either credential set.
- On the primary macOS release host, `android-build.sh` may load the two passwords
  from the documented macOS Keychain services; it never prints them.
