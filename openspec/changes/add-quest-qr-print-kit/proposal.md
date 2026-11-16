## Why

#3248: published quests have no reproducible A5 flyer/sticker kit for a venue QR pilot. Existing quest printing and QR/share attribution supply reusable styles, fonts and URL rules, but no compact venue handout.

## What Changes

- Add one local CLI taking a public quest id, placement code, locale and output directory; generate an A5 flyer and 100×120 mm sticker PDF.
- Use existing safe published discovery/detail projections and validators, never gameplay GETs that increment views. Print source title and duration; derive free wording from trip_facts.is_free and reuse the self-guided product contract.
- Encode canonical released URLs with utm_source=qr, standard referral medium and required placement campaign. Preserve explicit RU content fallback when a requested translation is not published.
- Reuse quest-print colors and licensed Noto fonts; vector QR with quiet zone, fitted readable titles and clickable PDF targets.
- Validate two real quests, all five copy resources, rendered PDFs, decoded QR targets, page geometry, text and source/campaign propagation.
- Non-goals: printing/distribution, venue pilot #3250, app screens, gameplay/content edits, backend changes, social/account actions or fake analytics starts.

## Capabilities

### New Capabilities
- `quest-qr-print-kit`: local, source-backed venue handout generation and campaign-bearing QR targets.

### Modified Capabilities
None.

## Impact

Platform impact: local script/PDF only; desktop/mobile/native screens unchanged. Localization impact: RU/BE/UK/PL/EN paper labels in existing books namespace via @/i18n; quest content remains API-owned. No app navigation, SEO, gameplay or public API contract changes. Anonymous safe API reads and standard GA UTM preserve the existing privacy/consent boundary. No personal or gameplay data is printed.
Dependencies: existing web publication projection, QR library, licensed fonts and Python reportlab/Poppler for local PDF authoring/verification. No paid/cloud resource. Fallback/mock policy: actual published data only; unknown duration stays unknown, a failed API read fails generation. Missing translated publication may use a clearly recorded RU source. The local publisher is not bootstrapped (503); validation runs the local CLI against actual anonymous production publication data, avoiding unrelated local publisher setup. An explicit local origin remains supported.
