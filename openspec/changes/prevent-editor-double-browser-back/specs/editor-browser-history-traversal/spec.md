## Purpose

Keep editor browser history faithful to each user action so a return to the own-travel list remains in the same document and subsequent navigation remains reliable.

## ADDED Requirements

### Requirement: One browser Back causes one return from the editor
The application SHALL return from an editor opened through the real own-list Edit control to exactly its preceding entry after one native browser Back, with no additional programmatic traversal.

#### Scenario: Editor first step and moderation reason
- **WHEN** an author opens their editor from the list and presses browser Back once on step1 without a sheet or step6 with a long moderation reason, in cold or warm desktop/mobile sessions
- **THEN** the list stays visible in the same document/timeOrigin after one popstate, no private editor residue remains and no article writes occur

#### Scenario: List has earlier application entries
- **WHEN** the same operation starts with at least two earlier in-app entries before the list
- **THEN** Back stays on the list rather than silently traversing to an earlier entry, and native Forward restores the editor

### Requirement: History remains consistent after external traversal
The application MUST preserve actual entry identity and forward-tail behavior for navigation performed after native browser Back or Forward.

#### Scenario: Follow-up push replace and app Back
- **WHEN** browser traversal is followed by a new navigation, replacement, app Back or native Forward
- **THEN** existing entry identity and actual predecessor are honored, new push removes the former forward tail, replacement changes only the current entry, and no duplicate traversal or stale entry is introduced

### Requirement: Direct entry and shared controls remain valid
The application SHALL preserve direct-entry fallback, allowed returnTo and public article history without changing native navigation or access policy.

#### Scenario: Direct editor and public controls
- **WHEN** an author opens an editor directly, enters it with an allowed returnTo, or traverses real public A/B/C cards
- **THEN** existing fallback and return behavior remain available, public history restores each article correctly and navigation creates no article writes or private-data leak
