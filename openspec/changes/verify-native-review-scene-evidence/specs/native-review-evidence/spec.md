## Purpose

Ensure native recording preparation relies on actual executed business assertions and identifies each requested complete scene or child segment without inflating partial coverage.

## ADDED Requirements

### Requirement: Readiness requires completed intended execution
A physical rehearsal SHALL contain exactly one intended passing testcase, zero failures, zero skips, zero expected failures, and a matching received-script hash with complete step and assertion counts. Passed labels and process exit zero alone MUST NOT qualify.

#### Scenario: Matching completed rehearsal
- **WHEN** the intended testcase passed and its received-script hash and completed counts match the requested scenario
- **THEN** execution verification permits the otherwise matching rehearsal

#### Scenario: Old label without execution
- **WHEN** a report claims passed and exit zero but lacks completed execution evidence
- **THEN** readiness rejects it

#### Scenario: Missing or incomplete execution
- **WHEN** no test ran, any test skipped or failed, the testcase identity differs, or script hash or completed counts differ
- **THEN** readiness rejects the report

### Requirement: Child coverage uses a closed parent and segment mapping
Content-report readiness SHALL recognize exactly the travel, comment, message, trip-chat, quest-review and photo segments under ugc-flag-content. Each requested child SHALL have an explicit exact coverage declaration and matching scenario/report identity. Unknown parents, segments or mapping declarations MUST be rejected. Requested identities SHALL be unique by parent and optional segment.

#### Scenario: Two independent assigned children
- **WHEN** photo and quest-review each have their own matching fresh complete child rehearsal
- **THEN** readiness can permit those two segments without claiming their parent or other four segments

#### Scenario: Unknown or duplicate mapping
- **WHEN** a segment is unknown, belongs to another parent, or repeats the same parent and segment request
- **THEN** readiness rejects that request

### Requirement: Full scene coverage cannot be inferred from children
Full parent readiness SHALL retain the explicit complete-parent coverage requirement and require declarations for all six required child segments in that parent's own complete scenario. Separate partial child reports MUST NOT aggregate into full parent readiness.

#### Scenario: Two children are not a parent
- **WHEN** photo and quest-review pass but the full parent is requested without its complete declaration and six segments
- **THEN** full parent readiness fails

#### Scenario: Full parent remains explicit
- **WHEN** a complete parent scenario declares the complete parent and all required segments and has matching successful execution
- **THEN** full parent readiness can pass without substituting independent partial reports

### Requirement: Child rehearsals preserve existing identity and history boundaries
Every child SHALL retain exact candidate, environment, runner, scenario hash, installed version/build observations and freshness checks. Readiness output SHALL distinguish requested complete scenes from requested segments and SHALL NOT attest installed TestFlight source, final video or privacy from synthetic evidence.

#### Scenario: Child candidate changes
- **WHEN** a child report's candidate, environment or scenario differs from its request
- **THEN** readiness rejects only the mismatching request

#### Scenario: Historical child is stale
- **WHEN** a child's rehearsal is older than 24 hours or has invalid timestamps
- **THEN** readiness rejects it while preserving unrelated existing evidence

### Requirement: Authentication evidence binds complete ordered phases
A whole authentication flow SHALL bind frozen public rehearsal and private diagnostic phases to one candidate, environment, device model and opaque random account reference. Every phase SHALL have intended completed execution; zero private assertions MAY qualify but no empty or skipped dispatch qualifies. Scenario/report changes, omitted/reordered/reused phases, wrong predecessor, stale/overlapping timestamps and identity mismatches MUST fail. Only the whole reviewed flow MAY declare login/register/account-delete coverage; isolated post-login phases MUST NOT do so.

#### Scenario: Private phase is safe to hand off
- **WHEN** a matching independently reviewed dummy-canary attestation exists, the private scenario submits and leaves credentials, and actual installed identity is verified before and after
- **THEN** the next public phase may execute without changing private diagnostic mode or adding fabricated candidate observations to its report

#### Scenario: Activation and deletion share a disposable fixture
- **WHEN** registration needs external activation
- **THEN** a receipt bound to the same disposable account and flow is required before activated signed-in assertions, and deletion plus failed re-login retain that fixture

#### Scenario: Partial or unreviewed draft
- **WHEN** selectors or fixture bindings are draft, or only a public post-login phase passed
- **THEN** no full authentication scene coverage is claimed

#### Scenario: Consistency is not provenance
- **WHEN** all receipt hashes match
- **THEN** output reports consistency only and retains independent TestFlight/source, backend transport, role and final video/privacy verification requirements

### Requirement: Authentication phases retain no automatic attachments
Every public or private authentication phase SHALL use keepNever for system and user attachments, including failure before the first public assertion confirms that credentials are absent. The runner SHALL reject other explicit policy values and explicit capture under the no-attachment policy. The complete flow SHALL reject missing or downgraded reported lifetimes. Runtime policy changes SHALL leave cached helper products intact and require fresh source-bound qualification.

#### Scenario: Public handoff fails with credentials still present
- **WHEN** the first public credential-form absence assertion fails
- **THEN** system and user attachments remain keepNever and the flow cannot claim success

### Requirement: Phase cleanup retains operation ownership
The host SHALL invoke the existing runner in-process, preserve its per-phase device-lock ownership and bounded subprocess cleanup, and refuse a phase that lacks its minimum remaining budget. Total budget and the explicit registration activation receipt path SHALL be validated before dispatch. The host SHALL NOT activate the account or extend the total deadline to start a phase.

#### Scenario: Insufficient budget or missing activation route
- **WHEN** the remaining phase budget is too short or registration has no named activation receipt path
- **THEN** no affected phase is dispatched and no successful flow receipt is produced
