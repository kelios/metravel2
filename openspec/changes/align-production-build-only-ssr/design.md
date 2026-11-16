## Context

The existing resolveDeployWebOutput already validates the backend SSR and quest
SSR capability. The wrapper currently calls it only inside the publishing branch.
Its real-shell fixture explicitly expects build-only web_output=unset. Both modes
already use the same fixed isolated worktree, dependencies and retained reports.

## Goals / Non-Goals

Goals: identical production output inputs for both modes, explicit failure without
capability and a read-only build-only path. Non-goals: changing byte caps, source
eligibility rules, dependency-install policy, publication or rollback semantics.

## Decisions

- Move the existing capability gate and three exports after the DEPLOY=1-only
  checkout guard. Reuse the current capability resolver; no duplicate mode policy.
- Force all three production inputs in both modes even if the caller inherited
  conflicting static flags. A capability failure exits before build-prod starts.
- Separate static preview from production measurement by the existing direct
  build-prod.sh invocation. A new preview flag and separate budget pins were
  rejected: no new mode or pin change is necessary for this defect.
- Compare exact entry bytes for the same frozen SHA, toolchain, effective flags
  and canonical worktree. Comparing current main against a different published
  revision would mix application changes into an infrastructure parity claim.
  Use the last successfully published source SHA for the real non-publishing
  comparison, and retain the complete guard result separately from other work.
- Unit tests run the actual wrapper against a temporary Git repository and fake
  backend/build boundaries. Runtime acceptance uses the actual capability and
  export, with no publication and no substituted application/API data.

## Risks and rollback

Build-only now requires backend access; callers needing offline static preview use
the existing direct command. Both modes fail closed on unavailable capability.
No production assets are written by the acceptance build. Rollback is the reviewed
wrapper/test/docs source diff; production publication is outside this task.

## Validation

Focused wrapper red/green including both flags, conflicting inputs and malformed,
disabled/unreachable capability; bash syntax, scoped ESLint, strict OpenSpec and
existing related webOutput tests; independent auditor and formal gate before
explicit-path commit/push. In testing, one canonical DEPLOY=0 build of the frozen
published source and exact entry comparison with its published artifact/report.
Other dirty tasks stay excluded. No browser/native/locale matrix is justified.
