## Purpose

Make conversations with similar participant names distinguishable from the conversation list while preserving compact rows, accessibility and moderation privacy.

## ADDED Requirements

### Requirement: Safe localized message preview
The conversation list SHALL show the latest message text on the second row line, with a localized current-user prefix for own messages. Deleted or moderation-hidden messages MUST show only a localized neutral deletion label, regardless of the payload text. Empty conversations SHALL show a localized no-messages label; responses without the optional preview field SHALL remain usable with an empty preview. API message content MUST NOT be client-translated.

#### Scenario: Distinguish similar names
- **WHEN** two conversations have similar participant names and different latest messages
- **THEN** each conversation shows its own preview without opening either chat

#### Scenario: Current user message
- **WHEN** the latest message sender is the current user
- **THEN** the preview uses the locale-specific current-user prefix and the unchanged message text

#### Scenario: Deleted message with unsafe payload text
- **WHEN** the preview indicates deletion or moderation hiding and contains nonempty text
- **THEN** only the neutral deletion label is rendered and announced, and the supplied text is never exposed

#### Scenario: Empty or older server response
- **WHEN** the preview is null or absent
- **THEN** null shows the no-messages label and absence keeps the existing conversation row usable without a preview

### Requirement: Stable responsive accessible rows
The list SHALL preserve the participant name on its own first line and constrain preview text to one line with end ellipsis. A 200-character preview MUST NOT increase row height relative to a short preview by more than 1 px on 320, 390 and 1440 px web viewports. The row accessibility label SHALL include the full preview and preserve unread, selection and delete behavior across RU/BE/UK/PL/EN and light/dark themes.

#### Scenario: Long message on narrow and wide viewports
- **WHEN** a short preview becomes a 200-character preview at 320, 390 or 1440 px
- **THEN** the preview remains one line, row height changes by at most 1 px and horizontal overflow does not occur

#### Scenario: Screen reader and locale changes
- **WHEN** the active locale changes or a screen reader focuses a conversation row
- **THEN** app-owned preview labels use that locale and the row announces full preview text alongside existing participant and unread information

### Requirement: Reuse conversation list data
Preview rendering MUST use the existing conversation-list response without per-conversation message requests and SHALL preserve conversation ordering, name search and adjacent conversation actions.

#### Scenario: Render and filter multiple previews
- **WHEN** several conversations are rendered and filtered by participant name
- **THEN** no additional per-conversation message fetch occurs and search results retain the existing order and actions
