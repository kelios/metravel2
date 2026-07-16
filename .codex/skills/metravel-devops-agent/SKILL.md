---
name: metravel-devops-agent
description: Deploy metravel web builds to dev, preprod, or production through the project-owned release scripts, the Windows/Codex ops wrapper, or the documented emergency frontend redeploy path, with preflight checks, server-path safety, secret hygiene, post-deploy validation, rollback awareness, and explicit environment gating. Use when Codex is asked to deploy, prepare a deploy, verify a deploy, rollback planning, or operate dev/prod release infrastructure.
---

# Metravel DevOps Agent

Use this skill for deploy preparation, deployment execution, and post-deploy verification. Treat production deploys as high-risk operations: require an explicit target environment and do not infer `prod` from vague wording.

Follow the project-owned deploy contract: use existing scripts, do not write ad-hoc `rsync`/`scp`/SSH deploy commands, take a health baseline, let build guards fail closed, swap static assets atomically, verify production, and keep a rollback path visible.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/RELEASE.md`
- `docs/PRODUCTION_CHECKLIST.md` when production or credentials are involved
- `docs/TESTING.md` when choosing checks

## Environment Gate

Before running deploy commands, report:

- target environment: `dev`, `preprod`, or `prod`
- current branch and `git status --short`
- operation gate result: active deploy/build/rebuild/test processes and relevant locks for the same target
- whether the worktree contains unrelated user changes
- SSH/access readiness for the requested target, without printing secrets
- planned checks and deploy command
- known blockers or missing access

Rules:

- Work from repo root only.
- Stay on `main`; if not on `main`, stop and ask.
- Never print secrets from `.env.*`, `.env.e2e`, SSH configs, EAS, or server logs.
- Before any authorized server write, inspect the backend checkout read-only with
  `git status --short` and classify every intended path through
  `git ls-files --error-unmatch -- <repo-relative-path>`.
- Never mutate a Git-tracked server path: no patch/overwrite/copy/move/delete,
  chmod, or backup file inside the checkout. Never run backend `commit`, `push`,
  `pull`, `merge`, `rebase`, `checkout`, `reset`, `restore`, `stash`, or `clean`.
- A dirty production checkout is a stop condition. Record exact paths and a
  secret-safe diff summary, create/update an `area=back`/ops task, and leave the
  cleanup plus canonical backend commit/deploy to the backend owner.
- Project-owned frontend release scripts may write only their documented
  untracked runtime/static targets such as `static/dist`.
- Do not modify production server paths, SSL paths, Nginx roots, aliases, includes, or proxy targets unless the target host path existence has been verified.
- Do not deploy `prod` unless the user explicitly requested production deploy in the current task.
- Do not run Android EAS/cloud builds, Android production builds/submits, or mobile store submit commands unless the user explicitly requested that Android/iOS build or submit target in the current task. Web deploy/release validation must not consume Android EAS build credits.
- If the worktree is dirty, deploy only when the dirty files are intentionally part of the deploy or the user explicitly accepts the risk.
- Before deploy, build, Android install, server rebuild, or server restart, apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`; if another agent already runs the same target operation, do not start a duplicate and report the PID/command/target blocker.
- Never edit server shell dotfiles such as `~/.bashrc`, `~/.profile`, `~/.zshrc`, `~/.ssh/config`, or `~/.ssh/environment`. Use inline env vars or project env files instead.

## Preflight

Choose the smallest safe preflight for the target:

- Dev deploy smoke: `npm run check:fast`, then `./build-dev.sh` for the LAN dev server (`192.168.50.36`) unless current project docs explicitly define a different dev target.
- Production deploy: prefer `npm run release:check` before deploy.
- Production build-only verification: `DEPLOY=0 ./build-prod.sh prod`.
- External-link/governance-sensitive changes: include `npm run governance:verify`.
- UI-visible changes: require browser verification before deploy when feasible.

Before a mutating deploy, also take a read-only baseline for the target, for example `/`, a representative API GET, and any changed route. Fix real failures in scope before deploy. If a failure is outside scope or needs unavailable access, stop and report the blocker.

## Deploy Commands

Use the existing scripts and documented ops wrapper; do not invent parallel deploy paths. The build scripts run the canonical web export, SEO/static generation, static travel SEO guards, public-file copy, and cache-bust post-processing.

Build without deploy:

```bash
DEPLOY=0 ./build-dev.sh
DEPLOY=0 ./build-prod.sh preprod
DEPLOY=0 ./build-prod.sh prod
```

Deploy:

```bash
./build-dev.sh
./build-prod.sh preprod
./build-prod.sh prod
```

Dev server deploy uses the documented `./build-dev.sh` path: it performs a clean dependency reinstall, builds `dist/dev`, uploads frontend static assets to `192.168.50.36`, swaps `static/dist`, and restarts `app` + `nginx`. Do not use `./build-prod.sh dev` as a substitute for the LAN dev-server deploy unless project docs have been updated to define that target.

### Production deploy from this Windows/Codex machine

On this workstation, `./build-prod.sh prod` is not the final deploy command: its local `rsync` deploy
step is known to fail under Git-for-Windows/MSYS2. For production deploys from
`D:\metravel\metravel2`, use:

```bash
bash /d/metravel/ops/deploy-frontend.sh
```

This wrapper:

- verifies branch `main` and SSH access to `metravel-prod`
- stops competing e2e/preflight/build processes unless `SKIP_KILL=1` is set
- runs `DEPLOY=0 bash ./build-prod.sh prod` so the canonical build and guards still run
- verifies `dist/prod` stability and SEO page count
- transfers with `tar+ssh` to `static/dist.new`
- atomically swaps `static/dist`, keeps `static/dist.bak`, overlays old Expo chunks, and restarts `app` + `nginx`
- runs health checks and auto-rolls back from `static/dist.bak` on failure

### Emergency production frontend redeploy

Use `scripts/fix-prod.sh` only when the user explicitly asks for emergency production frontend recovery or when the canonical production path is unavailable and the safer recovery path is justified in the handoff.

That script acquires a remote deploy lock, can rebuild `dist/prod`, verifies the production artifact config, uploads static assets, performs an in-container atomic swap, overlays missing old Expo chunks, restarts nginx, verifies the live entry/runtime chunks, and fails closed on wrong prod config. Do not use it as a casual shortcut for normal releases.

Manual rollback if needed:

```bash
ssh metravel-prod 'cd /home/sx3/metravel && mv static/dist static/dist.broken && mv static/dist.bak static/dist && docker compose -f docker-compose-prod.app.yaml restart nginx'
```

## Post-Deploy

For production:

- confirm the baseline URLs still return healthy status codes
- verify the current HTML references available static JS/CSS chunks
- run `npm run test:seo:postdeploy`
- run production performance checks when requested or when release risk warrants it:

```bash
npm run lighthouse:produrl:travel:mobile
npm run lighthouse:produrl:travel:desktop
npm run lighthouse:produrl:summary
```

For dev/preprod:

- verify the deployed URL or server endpoint relevant to the task when accessible
- report any access blocker instead of guessing success

## Handoff

Return a compact `Deploy Report`:

- target environment
- commit/branch/worktree state
- baseline health before deploy
- checks run and results
- deploy command run
- post-deploy checks and results
- rollback or follow-up tasks, if needed
