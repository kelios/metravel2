## Context

See proposal.md. Reuse AppInstallBar, RootWebDeferredChrome, Button/IconButton, appStore constants, incomingAppLinks route validation, externalLinks navigation chokepoint and the existing owner-keyed bottomChromeReserve map. No backend dependency or native configuration edits.

## Goals / Non-Goals

Keep a single mobile-only lazy offer and installation analytics. Do not detect installation by blur/timeouts, redirect on load, change ingress policy, or make a native store release. Unsupported routes open `/map`.

## Decisions

- Safari: static `apple-itunes-app` metadata with official app ID and safe `metravel://map` default; update app argument from the validated current location when the web bar is mounted. This is installation-aware OS UI. Same-domain HTTPS links can stay in Safari, so explicit custom Open uses the already registered scheme. iOS with no installed app may show an OS warning; Install remains independent. Source: https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners and https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links.
- Android: package-bound `intent:` URL using HTTPS app ingress, encoded fixed Google Play browser fallback, launched synchronously from a tap through externalLinks. No timer fallback. Source: https://developer.chrome.com/docs/android/intents/.
- Preserve path/query through mapIncomingAppLinkToHref; URL components containing intent delimiters are escaped. Reject untrusted destinations rather than forwarding arbitrary navigation.
- Replace the 12-second/scroll/cookie reveal gates with eligibility on mount after the existing mobile lazy loader. Read the existing dismissal timestamp with a seven-day bounded cooldown, ignore legacy conversion/permanent-count suppression. A store click is intent, not installation.
- Shared bottom reservation gains an owner-excluding numeric snapshot and subscriptions. The app bar stacks above the dock and other registered panels without feeding back its own reserve. Both consent and app bar reserve measured heights; translated two-row actions can grow safely. Alternative cookie gating retained the original discoverability failure; fixed top placement lacks a shared header inset.
- Copy lives in clean `shared_static.ts` files, React uses useTranslation, and existing analytics installation goal is retained; Open gets a distinct event.

## Risks / Trade-offs

- Native banner availability/OS dispatch → physical devices are required; browser emulation proves website UI and link construction only.
- Tall simultaneous panels on small screens → measured reservations, compact two-row offer, 320px browser checks, dismiss button.
- Blocked storage → fail open for UI, avoid exceptions; no secrets or arbitrary redirect targets.
- Static export/SSG → put meta in +html shell inherited by generated pages; canonical/robots/sitemap unchanged. No API, auth, editorial, media or cache contract changes.
- Performance → no added network or package dependency; reuse existing mobile chunk/icon and remove timer/scroll/consent polling. Rendering stability verified by screenshot and page interaction.

## Migration Plan

Keep the existing storage key and bounded dismissal history; legacy install clicks cannot permanently suppress Open. Review complete task diff, commit explicit paths, push main, deploy via frontend-deployer, then production browser acceptance. Revert the task commit for rollback.

## Validation Matrix

| Surface | Evidence |
| --- | --- |
| Source | Link safety/ingress, hint state, shared reserve and bar interaction unit tests; scoped lint/typecheck; external-links guard; test:i18n |
| Desktop web | Production 1440px: no custom bar |
| Mobile web | Production 320/390px iPhone + Android UAs: first visit, cookies, both actions, overlay, dismiss, seven-day state, route preservation, light/dark, RU/BE/UK/PL/EN screenshots and console |
| Physical iPhone Safari | Native Smart Banner installed/absent; Open on supported path; Install official listing; no automatic redirect |
| Physical Android Chrome | Installed app Open current path, absent app intent fallback, independent Install |

Unit mocks cannot close the physical OS scenarios. Availability of devices is an acceptance dependency, not proof of pass.
