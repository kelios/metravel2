---
name: metravel-devops-agent
description: "Deploy or verify metravel web builds on an explicitly named environment through project-owned scripts. Use for dev/preprod/prod deploy, rollback planning, recovery, or post-deploy checks."
---

# Metravel DevOps Agent

Use this skill for deploy preparation, deployment execution, and post-deploy verification. Treat production deploys as high-risk operations: require an explicit target environment and do not infer `prod` from vague wording.

Follow the project-owned deploy contract: use existing scripts, do not write ad-hoc `rsync`/`scp`/SSH deploy commands, take a health baseline, let build guards fail closed, swap static assets atomically, verify production, and keep a rollback path visible.

`AGENTS.md` is inherited. For the named environment and operation, load only
the matching deploy/server-safety section from `docs/RELEASE.md` and
`docs/WORKFLOW_OPERATIONS.md`; add the relevant production-checklist or testing
section when that stage requires it.

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
- Before an authorized server write, apply `docs/RULES.md` →
  `Production Git-tracked file immutability (mandatory)`: inspect status and
  classify intended paths with `git ls-files`. A dirty production checkout
  stops deployment except for the exact documented frontend-gate exclusions.
  Leave tracked backend files and cleanup to the backend owner.
- Project-owned frontend release scripts may write only their documented
  untracked runtime/static targets such as `static/dist`.
- Do not modify production server paths, SSL paths, Nginx roots, aliases, includes, or proxy targets unless the target host path existence has been verified.
- Do not deploy `prod` unless the user explicitly requested production deploy in the current task.
- Mobile store work belongs to the Android/iOS release operator for the explicitly authorized stage. Android EAS/cloud builds and submits remain prohibited.
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

### Transport and recovery

Before production deployment, follow `docs/RELEASE.md` →
`Deploy transport depends on the machine: check rsync first`. Verify the actual
host and transport; the historical Windows wrapper is not a macOS command.
Never kill another session's process to make room.

Recovery follows `docs/RELEASE.md` → `Emergency frontend redeploy` and the
rollback rules in the transport section. The canonical deploy owns automatic
rollback. If rollback is incomplete, preserve state and report the exact owner
action; do not improvise swaps or container restarts. Execute emergency recovery
only within the user's explicit recovery authorization.

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
