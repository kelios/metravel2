## Purpose

Defines the supported iPhone runtime contract for MeTravel, including identity, core flows, authentication, permissions, localization, links, session recovery, and release stability.

## ADDED Requirements

### Requirement: Supported iPhone identity and launch
The system MUST install and launch as the MeTravel iPhone application with the registered bundle identity, an increasing build number, and no dependency on a development server.

#### Scenario: User launches a release build
- **WHEN** a user opens the installed release or TestFlight build on a supported iPhone
- **THEN** the MeTravel shell becomes usable without a development server
- **AND** the application identifies itself with the registered production bundle identifier and release version

#### Scenario: Native initialization fails
- **WHEN** an optional native service cannot initialize during launch
- **THEN** the application does not crash or display an indefinite blank screen
- **AND** unrelated browsing remains available with a recoverable error for the affected service

### Requirement: Launch-critical product flows
The system SHALL support anonymous discovery, travel and quest details, maps and places, authentication, profile and settings, account deletion, media selection, sharing, and notification settings on iPhone without changing their established product meaning on other supported surfaces.

#### Scenario: Guest explores MeTravel
- **WHEN** a signed-out user opens the iPhone app and navigates through discovery, travel details, quest details, and public maps
- **THEN** public content remains available without forced registration
- **AND** account-only actions explain and open authentication only when invoked

#### Scenario: Authenticated user completes account flows
- **WHEN** a signed-in user opens profile and settings, restarts the app, and later requests account deletion
- **THEN** the authenticated session survives the restart until it expires or the user signs out
- **AND** account deletion is discoverable and can be completed through the existing server contract

#### Scenario: Network is slow or unavailable
- **WHEN** a launch-critical request is slow, offline, or fails
- **THEN** the app shows its existing localized loading, offline, empty, or retry state
- **AND** the user does not lose unrelated cached or already-visible content

### Requirement: Equivalent Apple authentication
The system MUST offer Sign in with Apple wherever iPhone users can establish or authenticate their primary account with Google or Facebook, and MUST exchange Apple credentials only with a server that verifies them.

#### Scenario: First Apple authorization succeeds
- **WHEN** Apple returns a valid identity token and the user authorizes the requested name and email data
- **THEN** the server verifies the Apple identity and returns the standard MeTravel session
- **AND** the app persists that session through the same secure native storage contract as other login methods

#### Scenario: Returning Apple user hides their email
- **WHEN** a returning user authenticates with the same Apple subject and a private relay address or no repeated name payload
- **THEN** the existing MeTravel account is resolved without creating a duplicate
- **AND** the absence of a repeated name does not block login

#### Scenario: Apple authorization is cancelled or rejected
- **WHEN** the user cancels Apple authorization or the server rejects the credential
- **THEN** no partial session is stored
- **AND** the app shows a localized recoverable state without exposing token details

### Requirement: Least-privilege iPhone permissions
The system MUST request camera, photo, location, notification, microphone, or background capabilities only when the corresponding user action needs them and SHALL preserve a useful alternative when an optional permission is denied.

#### Scenario: User denies an optional permission
- **WHEN** a user denies location, notification, camera, photo, or microphone access
- **THEN** the app explains the affected feature in the active locale
- **AND** unrelated browsing, manual search, and account flows remain usable

#### Scenario: A capability is not used by the release
- **WHEN** release evidence cannot demonstrate a user-facing need for an entitlement, background mode, purpose string, or collected-data declaration
- **THEN** that capability is removed from the release configuration rather than retained speculatively

### Requirement: Universal Link routing
The system SHALL open supported `https://metravel.by` links at the equivalent in-app route on cold and warm launch and MUST fail safely for unsupported or malformed links.

#### Scenario: Supported link opens a cold app
- **WHEN** the user opens a supported MeTravel travel, article, quest, map, or profile URL while the app is not running
- **THEN** the app starts and displays the matching destination after initialization

#### Scenario: Supported link opens a warm app
- **WHEN** the user opens a supported MeTravel URL while the app is already running
- **THEN** the existing app instance navigates to the matching destination without duplicating the navigation stack

#### Scenario: Link cannot be mapped safely
- **WHEN** an incoming URL is malformed, uses an untrusted host, or has no supported in-app route
- **THEN** the app does not execute or interpolate untrusted content
- **AND** it opens a safe app fallback or leaves the HTTPS URL to the system browser

### Requirement: Localized and accessible iPhone experience
The system SHALL expose app-owned runtime copy, native permission copy, errors, dates, numbers, and accessibility names in RU, BE, UK, PL, and EN, with RU as fallback, and SHALL preserve the chosen locale after a cold restart.

#### Scenario: User changes locale and restarts
- **WHEN** a user selects any supported locale and fully restarts the iPhone app
- **THEN** the selected locale is restored before launch-critical app copy is shown
- **AND** no untranslated key is visible in the tested core flows

#### Scenario: User uses iPhone accessibility settings
- **WHEN** the user enables larger text, VoiceOver, or reduced motion in a launch-critical flow
- **THEN** primary actions remain named, reachable, ordered, and tappable
- **AND** essential content is not hidden behind the notch, home indicator, keyboard, or clipped text

### Requirement: Cross-platform regression containment
The system MUST preserve desktop web, mobile web, and Android behavior when shared code is changed for iPhone support.

#### Scenario: Shared implementation changes
- **WHEN** an iPhone fix modifies a shared screen, service, storage adapter, localization resource, or navigation contract
- **THEN** the affected desktop-web scenario still passes
- **AND** the equivalent mobile-web and Android scenarios pass as a paired control
