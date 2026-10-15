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

### Requirement: Registration separates external activation from native login
Registration SHALL use exactly pre-register, registration-input, post-register, activation-login-input and registered. A matching external activation receipt SHALL precede post-register; the following private login SHALL use the same opaque disposable account. Native incoming-link policy MUST NOT be expanded merely to simplify evidence automation.

#### Scenario: Web activation alone
- **WHEN** a disposable account is activated outside the app
- **THEN** native signed-in coverage still requires the second private login and final public assertions

### Requirement: Failed re-login is synchronized and independently correlated
The preceding public phase SHALL assert the exact normalized EN rejection absent. The private phase SHALL submit, perform an exact bounded non-secret rejection tap, leave the form and clear the clipboard, with rejectionStep strictly between submit and leave. A matching independently reviewed actual native-response receipt SHALL prove prior valid same-fixture native login, successful deletion inside the delete phase, and POST login 401 invalid_credentials inside the private re-login phase. Separate host probes MUST NOT substitute.

The rejection SHALL distinguish native-response-body with rawResponseBodyObserved=true from native-ui-source-classification with rawResponseBodyObserved=false. Derived classification SHALL bind the exact private rejection step, scenario/report/completed-execution hashes, candidate source and current normalizer/EN error-copy source digest, alongside genuine correlated native/server 401 evidence. Independent operator verification SHALL establish source provenance. A derived classification MUST NOT claim an observed raw response body.

#### Scenario: Native UI classification without captured body
- **WHEN** actual native UI synchronization and source evidence classify a correlated native 401 without observing its body
- **THEN** the attestation declares derived classification, rawResponseBodyObserved=false and all required source/execution bindings; missing or mismatched bindings fail

#### Scenario: Origin and API base parity
- **WHEN** metadata names the API origin or its normalized /api base
- **THEN** request correlation requires exactly one /api prefix, matching the app; missing or duplicated prefixes fail

#### Scenario: Retained disposable login form
- **WHEN** the same disposable fixture signs in natively and is deleted in the unchanged app process
- **THEN** the deletion draft preserves accepted Terms and replaces both entire retained credential fields before re-login; exact edit-menu behavior is qualified first with dummy-only private canary evidence

#### Scenario: Reused error or unrelated host request
- **WHEN** stale-error absence is missing, synchronization is reordered, or the 401 came from an independent host probe
- **THEN** complete account-delete flow evidence fails

### Requirement: Independent observers know phase identity before dispatch
Each phase SHALL have a unique atomically published 0600 public context before driver dispatch, containing the opaque run/account binding and frozen source/scenario identities. The final chain SHALL bind its raw hash, exact identity and timestamp. Secret values, credential digests and raw device identifiers MUST NOT be published.

#### Scenario: Late or changed context
- **WHEN** a context is modified, reused, mismatched or published after phase start
- **THEN** whole-flow consistency fails
