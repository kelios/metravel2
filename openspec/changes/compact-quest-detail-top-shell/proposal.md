## Why

The quest detail stacks site branding, language versions and quest navigation above the reading area. Removing the language-version row alone leaves at least 174px of pinned chrome on 960×640 and 1024×768; the user requests a header occupying no more than 20% of the viewport.

## What Changes

- Give quest details one screen row with back, title, information, offline and overflow actions below the existing 1280px desktop boundary.
- Place route/progress in the existing reading scroll on windows below 840px high without a desktop route sidebar; retain the wide sidebar.
- Share route recognition and presentation geometry between first-frame reservation, global header and quest layout.
- Preserve route locale as content-language authority and the existing passive fallback-language notice.
- Keep the global web network notification away from the compact header by integrating it with existing measured bottom-banner reserves, preserving dock/menu and final-content access; pending consent/install offers temporarily yield to critical status without changing their saved state.

## Capabilities

### New Capabilities

- `quest-detail-top-shell`: bounded pinned quest chrome, a single title/action owner, and stable reading interactions across resize.

### Modified Capabilities

None. The existing short-phone placement remains; the new capability extends the same composition to tablet and landscape web.

## Impact

Platform impact: desktop web | mobile web. Native phone/tablet ownership is preserved; no native configuration or runtime change is intended.
Localization impact: all current locales for layout acceptance; no new copy or content translation.
Data/API, security and analytics: none; requests, persisted progress and events are unchanged.
SEO/accessibility: keep URL/canonical/JSON-LD and one H1; preserve 44px controls, keyboard focus and existing action sheets.
Performance: match pre-hydration slot and runtime dimensions; no new requests, media or dependencies.
Dependencies: no backend work; reviewed production rollout and browser evidence are required.
Fallback/mock policy: existing loading/error/offline behavior stays; mocks only support source regression tests.
Preserve: wide desktop brand/navigation/language control, route sidebar, all quest actions, passive fallback notice, answer/form and scroll identity.
Non-goals: catalog/city/country layouts, site navigation redesign, bottom dock, authored quest text, API contracts.
Production acceptance found a related interaction: at 960×640 the 60px offline status banner at top 0 covers the new 54px header, including the More target. The overlap already existed on narrow phones, and this composition exposes it on tablets. Closing this interaction belongs to the header task; unchanged banner source does not make the tablet regression acceptable.
Open questions: none.
