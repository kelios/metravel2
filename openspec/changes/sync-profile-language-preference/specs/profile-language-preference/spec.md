## Purpose

Keep the authenticated account's email language aligned with deliberate interface preferences while preserving local language use, temporary quest language and authentication boundaries.

## ADDED Requirements

### Requirement: Synchronize only deliberate supported preferences
The application SHALL synchronize RU/BE/UK/PL/EN only from a valid saved preference after hydration/login or a deliberate language selection. Initial Russian defaults, missing/invalid/unreadable storage, catalog loading and temporary quest URL language MUST NOT independently write the profile.

#### Scenario: Login with saved Polish preference
- **WHEN** a user logs in before or after a valid saved Polish preference finishes hydration
- **THEN** the authenticated owner's profile receives Polish once the preference is ready

#### Scenario: No saved preference or temporary quest locale
- **WHEN** a user has no valid saved preference or opens a translated quest without changing preference
- **THEN** no automatic profile-language write occurs from the fallback or quest locale

#### Scenario: Guest selection followed by login
- **WHEN** a guest selects a language and later logs in
- **THEN** selection stays local while anonymous and the saved effective language is synchronized after login

### Requirement: System mode resolves to a supported language
The application SHALL persist the effective supported device language to the profile when the user chooses system mode; it MUST NOT send system mode or null as the chosen profile language.

#### Scenario: English device language
- **WHEN** an authenticated user selects system mode on a device resolved to English
- **THEN** the account receives `en` while local system-mode preference remains intact

### Requirement: Latest deliberate choice wins
Rapid selections SHALL leave the latest deliberate language on the server and in the profile cache. Older initial reads, catalog loads and save responses MUST NOT restore an older preference or cached language; queued intermediate selections SHALL be replaceable by the latest selection.

#### Scenario: Slow Polish request followed by English
- **WHEN** Polish is saving and the user selects Belarusian then English
- **THEN** English is saved after the in-flight request and the stale Polish response does not replace the latest cached language

#### Scenario: Older catalog finishes last
- **WHEN** an older language catalog finishes loading after a newer explicit selection
- **THEN** the older selection does not become the persisted or synchronized preference

### Requirement: Respect owner and session boundaries
Profile writes SHALL target only the current authenticated owner. Logout, account changes, same-account re-login and runtime teardown MUST invalidate previous pending work and prevent stale responses from recreating or modifying profile cache entries for an obsolete session.

#### Scenario: Logout or another account during a save
- **WHEN** a save completes after logout or after switching accounts
- **THEN** its response does not update cache or show an obsolete error, and pending work for the former session is discarded

#### Scenario: Same account logs in again
- **WHEN** an account logs out and logs in again while an earlier save is in flight
- **THEN** the new session's latest valid preference is processed without allowing the obsolete response to restore old cache state

### Requirement: Preserve unrelated profile state
Language saves SHALL update only the accepted language of existing owner profile cache entries. Delayed profile-form or avatar responses MUST preserve a newer language. Missing cached profiles MUST NOT become incomplete profile objects.

#### Scenario: Concurrent profile edits
- **WHEN** a language save and a name, notification or avatar save complete in either order
- **THEN** their cache updates preserve unrelated current fields and the latest accepted language

### Requirement: Failed saves are visible and recoverable
A failed current account-language save SHALL show an existing-style error notification translated in the current UI language, preserve local selection, and permit a new explicit attempt without an unbounded retry loop.

#### Scenario: Current save fails
- **WHEN** the current authenticated preference cannot be saved to the server
- **THEN** one translated error explains the unsaved account language and another explicit selection can retry

#### Scenario: Superseded save fails
- **WHEN** an older save fails after a different language or session supersedes it
- **THEN** the obsolete failure does not show an error for the newer choice or account
