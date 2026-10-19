## Purpose

Defines the evidence and external states required to distribute a verified universal MeTravel iPhone/iPad build through TestFlight and submit it to App Review without exposing credentials or misstating privacy behavior.

## ADDED Requirements

### Requirement: Reproducible signed release build
The release process MUST produce a signed universal iPhone/iPad archive whose device family, orientations, bundle identifier, version, build number, entitlements, privacy manifests, and embedded configuration match the App Store Connect record.

#### Scenario: Release archive is created
- **WHEN** the authorized production build runs from the clean canonical source state
- **THEN** it produces a signed archive accepted for upload by App Store Connect
- **AND** the archive contains no development server address, placeholder store identifier, test credential, or private signing material

#### Scenario: Build configuration is inconsistent
- **WHEN** the device family, iPad window/orientation contract, bundle identity, signing team, version, entitlement, privacy manifest, SDK requirement, or production API configuration is missing or inconsistent
- **THEN** the release process fails before submission
- **AND** no incompatible binary is selected for review

### Requirement: TestFlight release validation
The system MUST make the candidate build available through TestFlight and SHALL require runtime evidence from that distributed build before App Review submission.

#### Scenario: Candidate reaches TestFlight
- **WHEN** App Store Connect finishes processing the uploaded build
- **THEN** the build is available to the intended internal test group
- **AND** required beta information, export-compliance answers, and test focus are complete

#### Scenario: Distributed build exposes a release defect
- **WHEN** TestFlight evidence shows a crash, hang, broken launch-critical flow, invalid permission behavior, or incorrect production configuration
- **THEN** the candidate is not submitted to App Review
- **AND** a corrected build with a higher build number repeats the release gate

### Requirement: Complete localized store record
The App Store record MUST contain the required product, privacy, support, review, age-rating, availability, and screenshot information, with RU as primary and RU, BE, UK, PL, and EN localizations where App Store Connect supports the field.

#### Scenario: Store metadata is prepared
- **WHEN** the release candidate is ready for store review
- **THEN** the record contains the app name, description, keywords, category, age rating, privacy policy URL, support URL, screenshots, copyright, review contact, review notes, and release setting required by App Store Connect
- **AND** the metadata describes only behavior present in the candidate build

#### Scenario: Universal device screenshots are prepared
- **WHEN** the universal candidate supports both iPhone and iPad
- **THEN** App Store Connect contains truthful screenshots for every required iPhone and iPad display class
- **AND** each screenshot is captured from the accepted build in a supported orientation without compatibility-mode framing

#### Scenario: App review requires authentication
- **WHEN** a launch-critical reviewed feature needs a MeTravel account
- **THEN** App Review receives a non-expiring demo account through the protected App Store Connect field
- **AND** no credential is written to Git, task descriptions, logs, screenshots, or public documentation

### Requirement: Accurate privacy disclosure
The release MUST declare the app's and embedded third-party SDKs' actual data collection, tracking, required-reason API use, permissions, and privacy-policy behavior consistently across the binary and App Store Connect.

#### Scenario: Privacy audit finds undeclared behavior
- **WHEN** a dependency or runtime flow collects, links, tracks, or accesses data not represented in the binary manifest or App Store privacy answers
- **THEN** submission is blocked until the behavior is removed or accurately declared

#### Scenario: User manages their account data
- **WHEN** App Review follows the privacy policy and in-app settings
- **THEN** it can find the existing account deletion path and applicable privacy choices
- **AND** the observed behavior matches the submitted privacy answers

### Requirement: Controlled App Review submission
The release process MUST submit only the accepted candidate after an explicit owner release decision and SHALL record the resulting App Store Connect state as evidence.

#### Scenario: Owner authorizes submission
- **WHEN** all implementation, TestFlight, store-record, privacy, and review-account gates are complete and the owner explicitly authorizes the final release action
- **THEN** the accepted build is added for review and submitted to App Review
- **AND** the recorded state is `Waiting for Review`, `In Review`, or the current equivalent returned by App Store Connect

#### Scenario: App Store Connect rejects the binary or metadata
- **WHEN** upload processing or App Review reports an invalid binary, missing compliance item, metadata rejection, or review rejection
- **THEN** the sprint is not represented as successfully submitted or released
- **AND** the exact finding is routed to the owning task before another build or submission

### Requirement: Approval timing boundary
The sprint MUST distinguish a successful submission from Apple's later approval and storefront availability.

#### Scenario: Submission is accepted into review queue
- **WHEN** App Store Connect accepts the complete submission into the review queue
- **THEN** the dated sprint submission milestone is satisfied
- **AND** storefront release remains pending until Apple approves the version and the configured release mode permits distribution
