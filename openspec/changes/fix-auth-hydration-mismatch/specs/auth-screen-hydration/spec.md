## Purpose

Define the observable hydration contract for the statically rendered sign-in and
registration screens: the server markup and the first client render must match,
provider availability must be decided only after a safe hydration handoff, and
the social sign-in behavior and fallbacks must survive that transition unchanged.

## ADDED Requirements

### Requirement: Auth screens hydrate without replacing their server markup

The sign-in and registration screens SHALL hydrate from their prerendered static
HTML without a hydration failure, when served from a minified export built with
the production configuration. No React hydration error, no uncaught page error,
and no console error MUST be emitted while the screen loads, and none MUST be
emitted after the first user interaction with the screen.

#### Scenario: Sign-in screen loads on desktop web

- **GIVEN** a minified production-config static export served over HTTP
- **WHEN** the sign-in screen is opened at a 1280-pixel-wide viewport and again
  at a 1440-pixel-wide viewport, and the page is allowed to settle
- **THEN** the recorded page errors and console errors contain zero React
  hydration errors, including error codes 418, 419, 423, and 425
- **AND** the recorded list contains no other uncaught page error

#### Scenario: Registration screen loads on mobile web

- **GIVEN** the same minified production-config static export
- **WHEN** the registration screen is opened at a 390-pixel-wide viewport and
  the page is allowed to settle
- **THEN** the recorded page errors and console errors contain zero React
  hydration errors
- **AND** the recorded list contains no other uncaught page error

#### Scenario: The user interacts with the screen after it settles

- **WHEN** the user performs a first interaction on either screen — focusing the
  email field, typing into it, and toggling password visibility
- **THEN** no hydration error and no uncaught page error is recorded during or
  after that interaction

#### Scenario: The hydration boundary that owns the social block is compared directly

- **GIVEN** the prerendered HTML of the sign-in screen and of the registration
  screen from the same export
- **WHEN** the element subtree containing the Google control and the Facebook
  control is compared against the first client render of the same subtree
- **THEN** the two produce the same element structure, in the same order, with
  the same element types and the same text content

### Requirement: The social sign-in block is visually stable across hydration

The social sign-in block SHALL occupy the same position and the same box on the
first paint and after hydration completes. Adopting the server markup MUST NOT
produce a visible repaint of the controls, and MUST NOT introduce additional
layout shift on either screen.

#### Scenario: Hydration completes on a settled screen

- **WHEN** hydration completes on the sign-in or registration screen
- **THEN** the Google control and the Facebook control keep the bounding box
  they had before hydration
- **AND** the measured cumulative layout shift for the screen is not higher than
  the value recorded for the same screen and viewport before the change

#### Scenario: Before/after visual comparison

- **GIVEN** a screenshot of the screen taken before the change and one taken
  after the change, at the same viewport and in the same theme
- **THEN** the two show the same layout, the same control order, and the same
  labels
- **AND** the comparison demonstrates the absence of layout shift rather than a
  new visual design

### Requirement: Provider availability is decided only after a safe hydration handoff

Host-dependent and browser-dependent provider availability — the hostname the
page is served from, the presence of an injected provider SDK, and any
local-development override — SHALL NOT influence the server render or the first
client render of a node that exists in the prerendered HTML. It SHALL be applied
only after the component that owns that markup has safely completed its
hydration handoff.

#### Scenario: The server render and the first client render agree

- **WHEN** the server render and the first client render of the social block are
  produced for the same screen
- **THEN** both resolve provider availability to the same value
- **AND** both emit the same markup for the Google control and for the Facebook
  control

#### Scenario: A loopback host is detected after hydration

- **GIVEN** the screen is served from a loopback host with no local override and
  no injected provider SDK
- **WHEN** hydration has completed
- **THEN** the Google control shows its explicit unavailable-on-localhost text
- **AND** that text was not present in the server markup or in the first client
  render

#### Scenario: A production host is detected after hydration

- **GIVEN** the screen is served from the production host
- **WHEN** hydration has completed
- **THEN** the Google control proceeds to its normal enabled flow
- **AND** no unavailable-on-localhost text is shown at any point

### Requirement: Social sign-in behavior and fallbacks survive the fix

The sign-in and registration screens SHALL keep their existing provider
behavior. The fix MUST NOT remove a social control, hide a provider error,
disable static rendering for these screens, suppress the hydration warning for
the affected subtree, or delay a control behind a timer.

#### Scenario: Google sign-in completes on the production host

- **GIVEN** the screen is served from the production host with a configured
  Google client id
- **WHEN** the provider SDK finishes loading and the user completes the Google
  flow
- **THEN** the rendered Google control is the provider's own control
- **AND** the returned credential is handed to the sign-in flow exactly as
  before

#### Scenario: The Google client id is not configured

- **WHEN** the screen renders with an empty Google client id
- **THEN** the Google control shows its existing not-configured state
- **AND** it is not silently presented as an enabled control

#### Scenario: Facebook login is behind its rollout flag

- **WHEN** the Facebook rollout flag is disabled
- **THEN** no Facebook control is rendered on either screen
- **AND** the server markup and the first client render agree on that absence

#### Scenario: Facebook login is enabled

- **WHEN** the Facebook rollout flag is enabled and the provider SDK is
  available
- **THEN** the Facebook control renders with its existing label, disabled/busy
  semantics and touch target
- **AND** the email-permission and email-completion panels remain reachable

#### Scenario: A provider script fails to load

- **WHEN** a provider SDK script fails to load
- **THEN** the existing provider error message is surfaced to the user
- **AND** the failure is not hidden in order to keep the error console clean

### Requirement: Auth screens keep their static rendering and metadata

Both screens SHALL continue to be delivered as prerendered static HTML with
their existing crawler metadata. The hydration fix MUST NOT be achieved by
removing server rendering for these routes.

#### Scenario: The export is inspected

- **WHEN** the production-config export is produced
- **THEN** the sign-in screen and the registration screen each have prerendered
  HTML containing the auth form markup
- **AND** each keeps its `noindex, nofollow` robots directive, its canonical
  URL, and exactly one visually hidden top-level heading

### Requirement: A regression guard fails on a returning hydration mismatch

The project SHALL keep an automated route-level guard that reproduces the
reported conditions: a minified production-config build, both auth screens, the
mobile and desktop widths under validation, and an assertion covering the state
before and after the first interaction.

#### Scenario: The guard runs against a minified production-config build

- **WHEN** the guard executes against a minified export built with the
  production configuration
- **THEN** it visits the sign-in screen and the registration screen at 390,
  1280, and 1440 pixel widths
- **AND** it fails if any React hydration error or uncaught page error is
  recorded before or after the first interaction

#### Scenario: The mismatch is reintroduced

- **GIVEN** a change that makes the first client render of the social block
  differ from the server markup
- **WHEN** the guard runs
- **THEN** it fails and names the affected screen and viewport

#### Scenario: The guard is not satisfied by a suppressed error

- **WHEN** the guard evaluates a build in which the hydration error is filtered,
  silenced, or downgraded rather than fixed
- **THEN** the guard still fails, because it also asserts that the server markup
  of the social block is adopted rather than replaced

### Requirement: Android auth behavior is unchanged

The shared sign-in and registration screens SHALL behave on the Android app
exactly as before the change. The web hydration fix MUST NOT alter the native
provider controls, their order, their labels, or their touch semantics.

#### Scenario: The auth screens are exercised on the connected Android device

- **WHEN** the sign-in and registration screens are opened in a locally built
  Android app on the connected device
- **THEN** the same fields, actions, block order, and provider controls are
  present as before the change
- **AND** no new runtime error appears in the device logs for those screens
