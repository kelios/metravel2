## Purpose

Keep contribution invitations and the content that follows them visually stable while a statically rendered page becomes interactive, without changing their final responsive appearance or available actions.

## ADDED Requirements

### Requirement: Contribution invitations have viewport-correct first-frame geometry

The system SHALL present regular and compact contribution invitations with the same viewport-correct container padding, layout, text sizing and action sizing before and after page hydration.

#### Scenario: Cold desktop catalog visit
- **WHEN** a visitor opens the Places catalog at a desktop width before client scripts are ready
- **THEN** the contribution invitation already has its final desktop geometry and hydration does not switch it from a stacked mobile invitation to a desktop row

#### Scenario: Cold mobile invitation
- **WHEN** a visitor opens a page containing a contribution invitation at a mobile width
- **THEN** the invitation keeps its existing stacked layout, readable copy and full-width actions across hydration

#### Scenario: Regular and compact invitations
- **WHEN** either invitation density is rendered at any supported responsive tier
- **THEN** its final spacing and action geometry remain the density's existing appearance and do not depend on a temporary unknown viewport

### Requirement: First-frame stabilization preserves invitation behavior

The system SHALL preserve invitation copy, destinations, accessibility, impression and click behavior while stabilizing its layout, and SHALL preserve the existing native layout and actions without requiring web-only behavior.

#### Scenario: Existing contribution action
- **WHEN** a visitor activates an invitation action after hydration
- **THEN** it keeps the same destination and analytics intent as before stabilization

#### Scenario: Native invitation
- **WHEN** an invitation is rendered on a native platform
- **THEN** it keeps its current responsive layout and actions without depending on web-only behavior
