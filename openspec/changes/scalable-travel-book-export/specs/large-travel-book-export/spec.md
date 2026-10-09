## Purpose

Обеспечить владельцу полный экспорт выбранной книги путешествий в один PDF независимо от количества её фотографий, путешествий и текста, с сохранением оформления и восстановлением длительной сборки.

## ADDED Requirements

Applicability: the new complete background PDF requirements below apply to the v2 desktop-web flow. Legacy native printing and mobile-web catalog visibility remain governed by the preservation requirement; this change does not promise native large-file delivery.

### Requirement: No logical content count caps
The system SHALL accept any finite authorized selection without product limits on the total or per-travel number of photos, travels, text characters or route points. Resource budgets MUST regulate execution rather than truncate content or require smaller books.

#### Scenario: Old limits are crossed
- **WHEN** a selection contains 51 travels, more than 30 gallery photos in one travel, more than 200 photo placements, a text field longer than 50000 characters or total text longer than 500000 characters
- **THEN** the selection is accepted for complete export and none of these counts is a rejection or omission reason

#### Scenario: Internal resource budget is reached
- **WHEN** preparation or rendering reaches its configured memory or time budget
- **THEN** execution continues in smaller resumable portions or returns an explicit recoverable failure without discarding selected content or reporting success

### Requirement: Complete selection and immutable source
The system SHALL freeze the ordered selected travel revisions, included content and settings for a job. Selecting all matching travels MUST cover every matching page independently of how many catalog cards the user has loaded.

#### Scenario: Two-year selection spans catalog pages
- **WHEN** the owner selects all matching travels for 2012 and 2013 while only the first catalog page has loaded
- **THEN** the confirmed snapshot contains all matching accessible travels for both years, ordered as requested, with the count visible before generation

#### Scenario: Content changes after acceptance
- **WHEN** a travel is edited after the job snapshot is finalized and the worker retries
- **THEN** the retry uses the same frozen version and settings rather than mixing old and new content

#### Scenario: A media object is replaced after the snapshot freezes
- **WHEN** an image at its original URL is replaced after the full content-and-media snapshot is frozen and the worker restarts
- **THEN** rendering uses the frozen bytes of that image, or stops if access was revoked, rather than downloading a new version under the old reference

#### Scenario: Empty or incomplete input
- **WHEN** a finalized selection is empty or required travel details cannot be obtained completely
- **THEN** the job does not claim a complete book and presents an actionable empty-input or incomplete-source result

### Requirement: One PDF with faithful settings and pagination
The system SHALL deliver one valid complete PDF preserving the selected order, enabled sections, theme, title, cover, captions, premium rules and image proportions. Long text and galleries MUST continue onto additional physical pages; final contents and folios MUST correspond to actual pages.

#### Scenario: Large chapter continues
- **WHEN** one chapter contains hundreds of photos and long rich text spanning many physical pages
- **THEN** all enabled content appears across continuation pages without clipped text, compressed-to-one-page gallery or missing photo placements

#### Scenario: An individual source value or atlas is larger than one portion
- **WHEN** a single rich-text paragraph or table, or the full set of map points, exceeds the declared portion budget
- **THEN** its ingestion and rendering remain bounded and preserve all enabled content through continuation, without first constructing the entire value or atlas in renderer memory

#### Scenario: Portions change
- **WHEN** the same snapshot is rendered using different internal portion sizes
- **THEN** content coverage, visible ordering, settings and final page references remain equivalent

### Requirement: Recoverable background lifecycle
The system SHALL provide owner-scoped resumable job state, progress, cancellation and idempotent retry. A transient client observation timeout or network failure MUST NOT create another job or fall back to a large local print document.

#### Scenario: Longer than current polling deadline
- **WHEN** a valid job is still running after 120 seconds
- **THEN** it remains identifiable and resumable, and the client does not start a second local generation

#### Scenario: Reload or offline period
- **WHEN** the user reloads or loses connection during generation
- **THEN** reconnecting restores the same job, snapshot and progress without re-uploading the entire book

#### Scenario: Worker restarts
- **WHEN** the worker stops after completing some portions
- **THEN** retry continues from validated checkpoints without duplicate pages or mixed snapshots

#### Scenario: Cancellation races completion
- **WHEN** the owner cancels during rendering or artifact finalization
- **THEN** the acknowledged terminal cancellation prevents later success notification or download and releases temporary resources

### Requirement: Verifiable completeness
The system MUST distinguish unique media resources from their intended repeated placements and SHALL publish a complete artifact only after every planned content block and media placement is verified. Missing or inaccessible media MUST NOT silently become a blank placeholder in a successful complete export.

#### Scenario: A photo is reused in text and gallery
- **WHEN** one resource appears in both the description and the gallery
- **THEN** it can be fetched once but both intended placements are preserved and counted independently

#### Scenario: Asset fetch fails
- **WHEN** a required photo returns an error or cannot be decoded after retries
- **THEN** the job exposes the incomplete-resource error and retry action and does not claim that the full PDF is ready

### Requirement: Private bounded execution and delivery
The system SHALL enforce owner access to selection, job, status and download; isolate untrusted media/content; clean expired/cancelled artifacts; and deliver large files without loading the whole file into application JavaScript memory. Executing a large book MUST remain within a declared tested worker resource budget.

#### Scenario: Unauthorized or expired result
- **WHEN** another account requests the result, access is revoked, or the artifact expires
- **THEN** the file is unavailable, private content is not disclosed and the owner receives the appropriate retry or expiry state

#### Scenario: Renderer capacity is unavailable
- **WHEN** the deployment has no approved isolated capacity for the PDF renderer
- **THEN** its capability is unavailable with an actionable status, and the client does not substitute a large browser document

#### Scenario: Increasing archive size
- **WHEN** the same maximum-size resource profile is exercised with 1000 and 5000 photos
- **THEN** processing respects the declared peak resource budgets across preparation, rendering and merging while coverage remains complete; longer execution and larger disk artifacts are allowed

### Requirement: Preserve existing surfaces and localized feedback
The system SHALL retain small-book printing and existing native print behavior, keep the mobile-web catalog visibility rule, and provide all new export statuses and errors in RU/BE/UK/PL/EN with RU fallback without translating editorial content.

#### Scenario: Small book and native control
- **WHEN** the existing small-book print flow is used on a supported surface
- **THEN** its selected settings, print availability, cancellation and media geometry continue to follow the existing contract

#### Scenario: Localized status
- **WHEN** the user opens the new job flow in any production locale
- **THEN** statuses and actions are localized with accessible labels while the travel's authored text remains unchanged
