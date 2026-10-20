## Purpose

Help mobile website visitors continue in the MeTravel application or reach its official installation page without losing control of browser navigation.

## ADDED Requirements

### Requirement: Discoverable mobile offer
The website SHALL offer explicit Open and Install actions to eligible iPhone and Android phone browser visitors on its first ready mobile render. The offer MUST coexist with cookie controls and navigation without overlapping them, be dismissible for seven days, and remain absent on desktop and standalone web-app surfaces.

#### Scenario: First visit without cookie decision
- **WHEN** an eligible visitor opens the mobile website with no saved cookie decision
- **THEN** the app offer is available above the cookie controls without covering either action set.

#### Scenario: Returning after a store click
- **WHEN** a visitor previously clicked a store link without dismissing the offer
- **THEN** a later visit can still offer opening or installing the app.

#### Scenario: Explicit dismissal
- **WHEN** the visitor dismisses the offer
- **THEN** it stays hidden for seven days and becomes eligible afterward, including after repeated dismissals.

### Requirement: User initiated app handoff
The website SHALL launch app navigation only after an explicit user action, preserve supported page paths and queries, and use the map as fallback for unsupported or unsafe destinations. It MUST NOT claim to know installation state from a browser timeout or focus event.

#### Scenario: Installed Android app
- **WHEN** the visitor taps Open in a supporting Android browser with MeTravel installed
- **THEN** the OS is offered only MeTravel as handler for the supported current destination.

#### Scenario: Android app absent
- **WHEN** a supporting Android browser cannot handle the Open action
- **THEN** it can open the official Google Play listing as fallback.

#### Scenario: iPhone browser
- **WHEN** the visitor taps Open on iPhone
- **THEN** an explicit MeTravel app link is offered to the OS and a separate App Store action remains available if the app cannot open.

#### Scenario: No forced navigation
- **WHEN** the page loads, scrolls, returns from background, or encounters a slow connection
- **THEN** it does not automatically launch an app or a store.

### Requirement: Safari native offer and localized controls
Exported pages SHALL include the official iOS app identity for Safari's native Smart App Banner. Website-owned labels and accessibility text SHALL follow the active RU/BE/UK/PL/EN locale.

#### Scenario: Safari chooses installed behavior
- **WHEN** eligible Safari on a physical iPhone processes the exported page
- **THEN** it can present its native Open or store offer according to OS installation state and user preferences.

#### Scenario: Translated narrow screen
- **WHEN** any supported locale is selected at 320px width
- **THEN** both action labels and the dismissal control remain visible and operable.
