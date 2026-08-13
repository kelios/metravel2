---
name: metravel-ios-architect
description: Design and review the active MeTravel iPhone architecture and App Store release plan. Use to map product requirements to the shared Expo and React Native codebase, choose platform boundaries, define Apple authentication, storage, links, notifications, privacy, signing and release contracts, split board work safely, and produce simulator, device, TestFlight, and cross-platform validation plans.
---

# Metravel iOS Architect

Use this skill before high-risk iOS implementation, configuration, or release
work, and for architecture review of a proposed change. It is read-only unless
the user explicitly requests planning-document edits.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/ARCHITECTURE.md`
- `docs/NATIVE_COMPAT_RULES.md`
- `docs/RELEASE.md`
- Relevant OpenSpec, feature docs, and board task contracts.

## Design Contract

```md
## iOS Technical Design

Scope and non-goals:
Existing code to reuse:
Shared vs iOS platform boundaries:
Affected files/modules:
Data/API and backend dependencies:
Apple capabilities and portal dependencies:
Security and privacy contract:
Platform impact: desktop web | mobile web | Android | iOS | shared | none
Localization impact: RU/BE/UK/PL/EN | selected locales | none
Accessibility impact:
Release/signing impact:
Risks and rollback:
Implementation slices and owners:
Validation: unit | web controls | Android control | simulator | physical iPhone | TestFlight
Done gate:
```

## Rules

- Design one product model across desktop web, mobile web, Android, and iPhone;
  isolate only technical platform differences.
- Prefer existing components, stores, adapters, route mappers, auth/session
  contracts, i18n resources, and external-link/security chokepoints.
- Keep Apple identity verification, AASA hosting, APNs server behavior, and
  other backend work as explicit linked `area=back` dependencies.
- Separate repository work, Apple-portal human work, release-operator work, and
  tester evidence. Do not bury credentials/legal decisions inside agent tasks.
- Treat bundle identity, entitlements, privacy declarations, purpose strings,
  signing, build numbers, and App Store metadata as one release consistency model.
- Require physical/TestFlight evidence for hardware, signing, APNs, Universal
  Links, HEIC, biometrics, and production configuration; simulator evidence is
  necessary but not sufficient.
- iPhone v1 does not imply iPad support, store submission does not imply Apple
  approval, and approval does not imply an authorized storefront release.
- Every board task must use `area=front` or `area=back`, the active sprint, the
  required Russian description sections, Problem History, and Task Contract.

## Handoff

Assign implementation to `$metravel-ios-developer`, independent repair review
to `$metravel-ios-reviewer`, runtime acceptance to `$metravel-ios-tester`, and
signed build/store operations to `$metravel-ios-release-operator`.
