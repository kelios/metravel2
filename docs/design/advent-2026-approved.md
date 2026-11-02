# Approved winter advent design — 2026-11-02

The owner approved this design in the current chat («апрув») and subsequently requested implementation («делай»). Later corrections remove all narrative window tooltips and the empty gift-image block. This tracked document is the implementation contract; the prototype is evidence, not application source.

## Preflight

- Task type/result: L, implement the approved seasonal UI and publish/accept the frontend release.
- Task-owned paths: `components/advent/**`, relevant `__tests__/advent/**`, the narrow canonical media terminal-error callback and its regressions, Christmas-specific `components/layout/Logo.tsx`/decoration, `app/global.css` seasonal hunks only, `assets/advent/2026/**`, seasonal assets, selected locale resources, this handoff, feature documentation and the OpenSpec change.
- Platform impact: shared UI; mobile web then desktop web. No native-only renderer/config change is planned; native-specific evidence is required if that boundary changes.
- Localization impact: RU/BE/UK/PL/EN for new UI/a11y. Editorial campaign copy, answers, dates and rewards remain unchanged.
- Risk/gates: shared dirty main; preserve unrelated changes. Review is code-only. Commit/push before testing; deploy through `frontend-deployer`; runtime acceptance on the deployed production SHA. No backend writes or store operations.
- Validation: targeted behavior tests, asset/geometry checks, relevant guards/lint/type/i18n; independent full-diff review; production browser 320/390 then 1440, dark/light and seasonal off.
- Decision: reuse the real campaign/hooks/sheet and replace the visual surface. A separate demo/calendar progress implementation is rejected because it would diverge from production state. Main risks are touch/media geometry and masking alignment; rollback is the task commit.

## Approved appearance

- One illustrated late-Soviet panel apartment-house facade, seen from the snowy street. Six floors × four apartments = 24 main windows. This is an illustration, not a location photograph.
- Each apartment has a different holiday preparation scene; pets, Christmas trees and travel details are part of the artwork. No scene captions, native title attributes or hover tooltips appear around the windows. Only day numbers are visible; accessible date/state labels remain.
- A little silvery moonlight brightens the upper-right facade and snow. Unopened windows retain dim warm room light behind translucent fern-like frost, with four alternating patterns. Opened/done windows remove frost/dimming and reveal clear, warm interiors. Today has a restrained focus/accent; completed tasks remain distinguishable accessibly.
- The facade geometry is invariant: aspect ratio 2/3; horizontal window centres 14.7%, 38.9%, 62.9%, 86.7%; vertical centres 11.7%, 25.0%, 38.7%, 52.1%, 65.8%, 79.4%. Glass width 17.1% of facade width, height 12.3% of facade width. Effective buttons at least 44×44 on the phone without overlapping neighbours.
- Three bonus doors are separate and labelled by their actual dates: 25 December, 31 December, 7 January. Keep their internal IDs 25/26/27 and the main progress denominator 24. Do not reveal the secret gift while locked.
- Today's main action precedes the facade; progress/countdown and sharing retain their real data and existing semantics. The November/pre-launch state remains useful and honest: future doors are disabled, with the existing countdown. No fake open windows are saved.
- The gift sheet keeps gift, task, reward, real CTA/answer/credit behavior. No decorative blank media rectangle. An optional valid `gift.image` may render through the canonical media primitive; absent/failed media must not leave an empty hero. No invented Toruń photo or unrelated illustration is attached to a real article.
- Brand decoration: the existing golden bird wears a small cap above its eye/beak; a small tree and warm lights sit alongside. No red scarf/tail strip. Keep compact header ownership and do not restore a duplicate mobile brand/navigation row on nested screens.
- Seasonal `auto`/`off`/manual Christmas choices, light/dark palette, print behavior and existing dates remain authoritative. Disabling decoration never hides the campaign or removes progress.

## Artwork and provenance

Source working evidence lives in the owner's task directory:

- Prototype: `/Users/juliasavran/.codex/visualizations/2026/11/02/01a19c29-bcbf-7793-aa8c-d49c6125ac44/christmas-advent-approved-2026-11-02-v3.html`.
- Facade: `artwork/urban-winter-facade.png` and WebP copy (900×1350, approximately 239 KB).
- Frost atlas: `artwork/window-frost-atlas.png` and WebP copy (800×800, four equal cells, approximately 266 KB).
- Full prompts: `artwork/urban-prompts.json`, `artwork/frost-prompts.json`. Mode: built-in image generation; approved art already exists, no new generation is needed.

Production copies and prompt provenance belong under tracked `assets/advent/2026/` (and seasonal asset directory as appropriate). Preserve originals; technical image preparation may reduce file size or slice the frost atlas without changing its painted content. Do not embed the 774 KB prototype/base64 or import unrelated trial artwork into the application.

## Acceptance and scope limits

1. `/advent` uses actual 27 campaign doors and existing event/callback flow. Opening an available window opens the existing sheet, saves the same real progress and clears that window's frost. Locked/identity-not-ready gates remain enforced.
2. Mobile 320/390 and desktop 1440 have no overflow, overlap, scene-caption tooltips or blank sheet media. Date/CTA text remains readable in expanded locales. Art and overlay geometry are stable before/after hydration.
3. Light/dark and seasonal off preserve hierarchy, campaign availability and information. Images load from published release assets with no failed requests; no JS errors or hydration failures.
4. Static/unit tests cover 24+3 routing, state-to-light behavior, disabled windows, media fallback and the seasonal brand boundary. Review precedes runtime testing.
5. Production acceptance records `/.build-source.json`. Client future-clock rendering may verify guest visual states only; it cannot prove future server credit, handoff, rewards or authenticated progression. Existing #2867/#2868/#2940 temporal testing gates are not closed or overwritten by this visual train.
6. Do not change the base `html:not([data-season])` theme, concurrently edited HomeHero, map/auth providers, campaign editorial content, API contracts, server code or protected project configuration.
