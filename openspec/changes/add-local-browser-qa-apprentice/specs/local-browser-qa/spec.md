## Purpose

Локальный исполнитель помогает исследовать сайт собственными сценариями,
сохраняя проверяемые действия и границы покрытия для независимой приёмки.

## ADDED Requirements

### Requirement: Separate bounded local QA session
The runner SHALL use only the selected local model, a fresh browser context and
an explicit viewport, and MUST stop at its operation budget without replacing
the normal development agent or using cloud fallback.

#### Scenario: Backend unavailable
- **WHEN** the selected local backend is unavailable
- **THEN** the run reports the exact unavailable prerequisite without another provider

#### Scenario: Budget exhausted
- **WHEN** the run reaches the step or time budget
- **THEN** partial artifacts are preserved and the run is not accepted as a QA pass

### Requirement: Guest exploration authority
The default profile SHALL expose browser interaction and access to its own
artifacts, with product editing, shell, board writes, unsafe page code and
content publication unavailable. Mutating requests and external top-level
navigation MUST be blocked by the default browser policy.
Explicit navigation accepts only owned HTTPS URLs. Top-level 3xx responses,
including internal canonical redirects, are conservatively policy-blocked.
Browser-named artifacts SHALL stay in a child workspace that cannot overwrite
supervisor events/configuration/receipts. Native Read SHALL resolve symlinks
before allowing access to the batch's files.

#### Scenario: Submit a mutating request
- **WHEN** an action causes a non-read request
- **THEN** the request is blocked and recorded as a QA policy boundary, not a website defect

### Requirement: Evidence and independent acceptance
The run SHALL retain the initial plan, tool outcomes, observed page URLs and
artifacts. The result MUST distinguish CLI completion, incomplete output and
teacher acceptance. A path to an image alone SHALL NOT prove visual input.
Cases SHALL declare `kind: functional|visual` and typed observations/evidence.
A completed visual case requires the same image evidence file in a successful
native Read event with an image attachment. This does not prove provider wire
delivery. NOT_TESTED retains a reason without fabricating observations.

#### Scenario: Invented completed navigation
- **WHEN** a report claims a successful navigation absent from actual page observations
- **THEN** the report cannot be accepted by the teacher as a completed scenario

#### Scenario: Image only saved
- **WHEN** a screenshot file exists but no image input is established
- **THEN** visual observations remain unverified even when the CLI exits zero

### Requirement: Explicit coverage limits
The report SHALL separate scenario actions from plans and identify untested
routes, roles, locales, viewports and states. Guest browsing MUST NOT claim
coverage of authenticated mutations, paid generation or the whole site.

#### Scenario: Partial public sweep
- **WHEN** only public guest scenarios are executed
- **THEN** authenticated and mutating flows remain NOT_TESTED and no site-wide PASS is issued
