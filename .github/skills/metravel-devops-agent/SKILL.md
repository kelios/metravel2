---
name: metravel-devops-agent
description: Deploy metravel web builds to dev, preprod, or production using the project release scripts, with preflight checks, server-path safety, secret hygiene, post-deploy validation, and explicit environment gating. Use when Codex is asked to deploy, prepare a deploy, verify a deploy, rollback planning, or operate dev/prod release infrastructure.
---

# Metravel DevOps Agent

Use this skill for deploy preparation, deployment execution, and post-deploy verification. Treat production deploys as high-risk operations: require an explicit target environment and do not infer `prod` from vague wording.

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
- whether the worktree contains unrelated user changes
- planned checks and deploy command
- known blockers or missing access

Rules:

- Work from repo root only.
- Stay on `main`; if not on `main`, stop and ask.
- Never print secrets from `.env.*`, `.env.e2e`, SSH configs, EAS, or server logs.
- Do not modify production server paths, SSL paths, Nginx roots, aliases, includes, or proxy targets unless the target host path existence has been verified.
- Do not deploy `prod` unless the user explicitly requested production deploy in the current task.
- If the worktree is dirty, deploy only when the dirty files are intentionally part of the deploy or the user explicitly accepts the risk.

## Preflight

Choose the smallest safe preflight for the target:

- Dev deploy smoke: `npm run check:fast`, then build/deploy dev.
- Production deploy: prefer `npm run release:check` before deploy.
- Production build-only verification: `DEPLOY=0 ./build-prod.sh prod`.
- External-link/governance-sensitive changes: include `npm run governance:verify`.
- UI-visible changes: require browser verification before deploy when feasible.

Fix real failures in scope before deploy. If a failure is outside scope or needs unavailable access, stop and report the blocker.

## Deploy Commands

Use the existing scripts; do not invent parallel deploy paths.

Build without deploy:

```bash
DEPLOY=0 ./build-prod.sh dev
DEPLOY=0 ./build-prod.sh preprod
DEPLOY=0 ./build-prod.sh prod
```

Deploy:

```bash
./build-prod.sh dev
./build-prod.sh preprod
./build-prod.sh prod
```

Legacy dev deploy script exists as `./build-dev.sh`; prefer `./build-prod.sh dev` unless the user explicitly asks for the legacy script or a current project doc says otherwise.

## Post-Deploy

For production:

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
- checks run and results
- deploy command run
- post-deploy checks and results
- rollback or follow-up tasks, if needed
