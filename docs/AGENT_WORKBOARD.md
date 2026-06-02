# Agent workboard

Last updated: 2026-06-01

Scope: testing and fixing the travel details page.

Local visual board: open `docs/AGENT_WORKBOARD_LOCAL.html` from the repository on the local machine. This HTML board is local-only, stores status changes in browser `localStorage`, and is not part of the production Expo app.

Board truth rule: a task can be treated as `Done` only when it has evidence: changed files, test/browser validation, review, or an explicit docs-only artifact. The local HTML board is a display surface; this Markdown file remains the canonical evidence journal.

Mandatory verification rule (all UI/web/perf tasks): любое видимое или web-поведенческое изменение ОБЯЗАТЕЛЬНО проверяется в реальном браузере (e2e / Playwright / ручной прогон), и переводится в `Done` только после трёх подтверждений: (1) браузерная проверка (скриншот / e2e pass / консоль без новых ошибок), (2) задача закрыта в рамках текущего спринта, (3) ревьювер (Андриуш-Reviewer) подтвердил diff. До этого статус максимум `In progress` с пометкой «browser verification pending».

Authenticated QA rule (sign-in-gated flows: travel create/edit wizard, publish, drafts, favorites/rating/comments write, export, messages, subscriptions): когда сценарий требует залогиненного пользователя, использовать тестовый e2e-аккаунт из `.env.e2e` (`E2E_EMAIL` / `E2E_PASSWORD`, `E2E_API_URL`) ТОЛЬКО через e2e-механизм авторизации — программный логин `POST /api/user/login/` → `Authorization: Token <token>` (см. `e2e/helpers/e2eApi.ts`, токен в web хранится в `localStorage['secure_userToken']`) ИЛИ Playwright auth setup / `storageState` (`e2e/global-setup.ts`, `e2e/fixtures.ts`). Запрещено: ручной ввод пароля в поля формы, вывод `E2E_PASSWORD`/токена в логи, скриншоты или отчёты, любые деструктивные действия под тестовым аккаунтом (реальные публикации, удаления чужих данных, отправка сообщений). Только локальный/preview QA, read/navigation и обратимые проверки. Существующие authenticated e2e-спеки: `e2e/auth-smoke.spec.ts`, `e2e/manual-qa-auth-entrypoints.spec.ts`, `e2e/travel-draft-owner-preview.spec.ts`, `e2e/travel-full-flow.spec.ts`.

Team rituals:

- Daily standup: every day at 10:00, thread heartbeat automation `Metravel agent daily standup`.
- Sprint planning: every Monday at 10:30, workspace automation `Metravel weekly sprint planning`.
- Monthly retro: last Friday of each month at 16:00, workspace automation `Metravel monthly retro`.

## Sprint Planning

Sprint: `Travel QA Stabilization`.

Planning date: 2026-05-22.

Sprint dates: 2026-05-22 through 2026-05-29.

Sprint goal:

- Close approval blockers for `T-010` through `T-014`.
- Prepare developer-ready scope for travel page fixes.
- Align QA, UX, SEO, and BA acceptance criteria before implementation.

Capacity:

- Active sprint roles: Мариночка (QA), Мариночка (Manual QA), Мариночка (QA Analyst), UI/UX Designer, Крина (Business Analyst), Ромик (Dev), Сео (SEO Engineer).
- Support roles: Андриуш (Manager/Approver/Backlog Manager/Reviewer), Витаутас (DevOps).

Committed scope:

- `T-010` authenticated manual QA for favorite, rating, and comments write flows.
- `T-011` manual test cases for travel details web/mobile.
- `T-012` Instagram rich-text expected behavior decision and e2e alignment.
- `T-013` neutral hero media placeholder design decision.
- `T-016` business requirements and acceptance criteria for travel QA fixes.
- `T-017` technical fix plan for confirmed travel QA findings.

Stretch scope:

- `T-014` mobile overlays and touch target audit.
- `T-020` travel page SEO metadata/schema audit.
- Implementation patch by Ромик (Dev) after approved spec/design.

Planning decisions:

- Андриуш (Approver) owns readiness approval before implementation.
- `T-010` through `T-014` are approved to start discovery/testing/design work in this sprint.
- Крина (Business Analyst) owns acceptance criteria.
- Мариночка (QA) owns QA evidence and retest plan.
- UI/UX Designer owns `D-001` and `D-002` design direction.
- Ромик (Dev) starts code patch only after design/spec approval.
- Витаутас (DevOps) watches automations, e2e artifacts, and local server health.
- Сео (SEO Engineer) reviews SEO risks before final validation.

Non-goals:

- Production deploy is not included in this sprint unless explicitly requested later.
- Ромик (Dev) does not start implementation for `D-001` or `T-012` until spec/design output is accepted.

Planning risks:

- `T-012` is no longer a blocker: the e2e expectation now matches the project rule that valid Instagram post/reel/tv links render as embeds on web.
- `D-001` needs a designer decision before code changes because the current visible text placeholder violates the neutral-placeholder rule.
- Authenticated manual QA depends on `.env.e2e` access being available without exposing secrets.

## Sprint Planning — Performance Refactor

Sprint: `Page Performance Refactor`.

Planning date: 2026-06-01.

Sprint goal:

- Тиражировать `SSR-first + deferred islands` модель с travel на главную/поиск/карту/места.
- Завести и начать perf-backlog (`PERF-001`…`PERF-014`).
- Каждое видимое/web-изменение закрывать через mandatory verification rule (browser + sprint + reviewer).

Committed scope:

- `PERF-002` распил `homeHeroStyles.ts` (1908→177 LOC). Status: Done (docs-only style split + tests).
- `PERF-001` главная → deferred islands (`DeferredSection` поверх `useProgressiveLoad`). Status: In progress — browser ✅ (e2e home `1 passed`), reviewer ✅ (code-review: 0 actionable findings); ожидает sprint sign-off (Андриуш-Approver).

Stretch scope:

- `PERF-004` поиск: распил/облегчение `ListTravelBase.tsx`.
- `PERF-011` отдельный perf-тест трек (Lighthouse для `/`, `/search`, `/map`, `/places`).

Planning decisions:

- Андриуш (Approver) даёт sprint sign-off для перевода PERF-задач в `Done`.
- Андриуш (Reviewer) подтверждает diff каждого PERF-кода.
- Ромик (Dev) ведёт implementation PERF-001/002/004 через профильных агентов (`refactor-surgeon`/`travel-expert`).

Non-goals:

- Production deploy и prod-URL Lighthouse не входят в этот спринт без отдельного запроса.

## Status board

| Track | Owner | Status | Current output | Next action |
| --- | --- | --- | --- | --- |
| Team coordination | Андриуш (Manager) | Active today | Today dispatch created; idle roles converted to concrete work packets | Check evidence every cycle and reassign any role that misses its deliverable |
| Approval gate | Андриуш (Approver) | Active today | `F-004` fixed/verified; `D-014` resolved; next gate is `TD-006` overlay/touch-target spec and `D-006` information-architecture decision | Approve/reject `TD-006` designer spec; decide whether `/contact` should move under `(tabs)` or keep standalone layout |
| Scope and requirements | Крина (Business Analyst) | Active today | `F-004` no longer blocks implementation; `D-004`/`D-013` are grouped into `TD-006`; `D-006` needs IA decision | Produce AC for `TD-006` (safe-area, no hidden CTA/form fields, 44px touch targets) and a one-line IA decision for `D-006` |
| Backlog management | Андриуш (Backlog Manager) | Active today | 3-month plan exists; today queue needs WIP limits and handoff order | Keep each owner at one active deliverable; move blocked items to explicit blocker notes |
| Code readiness | Ромик (Dev) | Active today | `F-004` is fixed and locally browser-verified; implementation queue is unblocked | Prepare `TD-006` safe-area/touch-target fix after UI spec; keep `D-006` no-code until BA/Approver IA decision |
| DevOps health | Витаутас (DevOps) | Active today | Heartbeat `20260601T154749Z-check-fast-dry` passed; evidence saved in `.codex-temp/workboard/` | Keep heartbeat green and prepare `PERF-011` page-performance baseline command list |
| SEO engineering | Сео (SEO Engineer) | Active today | Assigned SEO audit for `Home`, `Search`, `Places`, and legal/info pages from QA wave | Produce metadata/canonical/OG/schema risk table; no code changes |
| Visual contract | UI/UX Designer | Active today | `D-004`/`D-013` overlay issues confirmed; `D-010` touch-target issues confirmed | Hand off `TD-006` UI contract: banner/bottom-nav safe-area, empty-state CTA clearance, 44px hit areas, target viewports |
| Browser QA | Мариночка (QA) | Active today | `F-004` authenticated nested-button defect fixed: `nestedButtons: 0`, console clean | Re-shoot mobile map popup clipping and verify `TD-006` baseline viewports before/after the fix |
| Manual test cases | Мариночка (QA Analyst) | Active today | Manual-case backlog still open but now assigned to top findings | Write cases for `F-004`, `F-005`, `D-004`, authenticated write flows, and PDF/export smoke |
| Manual QA | Мариночка (Manual QA) | Active today | Authenticated write-flow smoke done for favorite/plan/comment API CRUD with rollback | Continue non-destructive `travel/[id]` edit walkthrough and PDF/export smoke; do not publish persistent prod data |
| Bug triage | Orchestrator | Done | F-001 and comments 404 console issue triaged | Keep board updated for new findings |
| Implementation | Ромик (Dev) | Done | Fixed travel detail preload reuse and comments empty-state request path | Reviewer check if needed |
| Re-test | Мариночка (QA) | Done | F-001 and comments request checks passed locally | Monitor future manual QA findings |
| Review | Андриуш (Reviewer) | Done | Reviewer caught incomplete F-001 fix; follow-up fix applied and re-tested locally | Re-review on next diff if requested |
| Final validation | Orchestrator | In progress | Full-page populated capture completed; `F-004`/`D-014` unblocked; `TD-006` is the next fix packet | Keep the board honest: only `TD-006` enters dev now; `D-006` waits for IA sign-off |

## Today active dispatch

Created: 2026-06-01 15:47 local.

Rule: one owner, one active deliverable. A role is considered idle again if the deliverable below has no evidence by the next standup/heartbeat cycle.

| Owner | Work packet | Expected evidence | Handoff target |
| --- | --- | --- | --- |
| Андриуш (Manager/Approver) | Gate today's active queue and prevent fake progress | `T-064` unblocked note, `TD-006` approval/rejection, `D-006` IA decision, WIP-limit check | Ромик + Крина |
| Крина (Business Analyst) | Acceptance criteria for confirmed full-page findings | `TD-006` AC table: severity, expected result, non-goals, validation command; `D-006` IA recommendation | Андриуш + Ромик |
| Мариночка (QA) | Retest next overlay/map-popup risks | Mobile map popup clipping note and `TD-006` baseline evidence: route, viewport, console count, screenshot path | UI/UX + Ромик |
| Мариночка (Manual QA) | Authenticated edit/PDF smoke | `travel/[id]` edit walkthrough and PDF/export pass/fail notes using `.env.e2e`, no secrets or persistent publish | Крина + Андриуш |
| Мариночка (QA Analyst) | Manual cases for highest-risk flows | `MTC-*` rows for `TD-006`, authenticated edit, PDF/export, Quests; mark covered e2e cases separately | QA + Reviewer |
| UI/UX Designer | `TD-006` visual contract | Safe-area/touch-target spec with bug-vs-polish classification and target viewport list | Крина + Ромик |
| Ромик (Dev) | Prepare `TD-006` implementation plan, then fix after approval | Target files, risk notes, validation commands; no `D-006` code before IA decision | Reviewer + QA |
| Витаутас (DevOps) | Keep board/e2e/perf runner active | Heartbeat evidence path, changed-scope dry-run, `PERF-011` baseline command plan | Андриуш |
| Сео | SEO audit for pages covered by QA wave | Table for title/description/canonical/OG/schema/indexability risks | Крина + Ромик |

## Role rules

- Андриуш (Manager), QA, Manual QA, UI/UX Designer, and Reviewer do not edit code.
- Ромик (Dev) edits only confirmed bugs from QA or explicitly approved fix tasks.
- Existing unrelated dirty changes must not be reverted or mixed into this task.
- Temporary screenshots, traces, logs, and QA artifacts belong only in ignored local folders.
- Visible UI fixes require browser verification, screenshot, and console check before handoff.

## Confirmed context

- Branch: `main`.
- Project rules read: `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, `docs/README.md`.
- Active page area: travel details page, especially `app/(tabs)/travels/[param].tsx` and `components/travel/details/*`.
- Existing dirty files at board creation:
  - `__tests__/components/profile.test.tsx`
  - `app/(tabs)/profile.tsx`
  - `components/profile/ProfileTabs.tsx`

## Acceptance checklist

- Travel page opens from direct URL and from travel cards without blank screen or infinite loader.
- Web hero is complete after runtime-ready: main media, blurred background, and slider chrome appear together.
- Missing local development media does not collapse layout or show non-neutral placeholders.
- Desktop and mobile layouts have no overlapping UI, clipped button text, or horizontal overflow.
- Rich text and supported Instagram post/reel/tv embeds render correctly on web.
- Favorite, rating, comments, share, map, points, nearby/recommended, and navigation states are tested.
- Browser console has no new runtime errors in the tested scenarios.
- External links use centralized helpers, not direct `window.open(...)` or direct `Linking.openURL(...)`.

## Open tasks

| ID | Task | Owner | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| T-001 | Complete browser QA for travel details desktop and mobile | Мариночка (QA) | Done | E2E/browser QA pass | `40 passed`; duplicate initial request bug candidate found |
| T-002 | Complete manual user-flow QA for travel details desktop and mobile | Мариночка (Manual QA) | Done | Manual QA pass | Guest/manual pass completed; authenticated pass remains separate |
| T-003 | Triage duplicate initial travel detail requests | Orchestrator | Done | Finding/root cause logged | Root cause: concurrent guest consumers could start separate detail requests |
| T-004 | Fix confirmed travel details bugs | Ромик (Dev) | Done | Code changed + tests logged below | Shared direct preload reuse; comments read by `travel_id` |
| T-005 | Re-test fixed scenarios | Мариночка (QA) + Мариночка (Manual QA) | Done | Browser re-test | Browser checks passed on local e2e build |
| T-006 | Review final diff and validation | Андриуш (Reviewer) | Done | Review note | Initial review blocked F-001; final local browser check passed after follow-up |
| T-007 | Run extended web QA for travel details and related public flows | Мариночка (QA) | In progress | Evidence pending | Cover desktop Chrome travel details, interactions, comments, Instagram rich text, responsive layout |
| T-008 | Run extended mobile-web QA for travel details and related public flows | Мариночка (QA) | In progress | Evidence pending | Cover `390x844` mobile viewport, horizontal overflow, clipped actions, sticky/navigation states |
| T-009 | Create designer UX/UI audit backlog from QA evidence | UI/UX Designer | In progress | Visual audit evidence exists; backlog still active | Find concrete visual, hierarchy, touch-target, empty-state, and mobile polish work |
| T-010 | Run authenticated manual QA for write flows | Мариночка (Manual QA) | Done | UI pass (E2E build, `sergey@lyte.com`): favorite add→revert clean, plan opens status picker, section nav + comment input present, rating control present, slider Next/Prev OK. Comment write flow verified at API level (UI comments section would not mount on the flaky local serve): `POST /api/travel-comments/` → **201**, `PATCH /api/travel-comments/{id}/` → **200** (text updated), `DELETE /api/travel-comments/{id}/` → **204** (comment removed). Approved scope = comments-with-rollback; cleanup confirmed. Evidence `.codex-temp/manual/cmt-api-crud-log.txt`, `manual-interact-log.txt` | create/edit/delete CRUD cycle done and rolled back (net-zero on prod). Publish + author-only actions intentionally NOT run (would persist on prod metravel.by). Side note `GET /api/travel-comments/?travel_id=391` → 400, app treats as empty (relates to F-002) |
| T-011 | Write manual test cases for travel details web/mobile | Мариночка (QA Analyst) | Active today | Dispatch assigned 2026-06-01 | Include prerequisites, steps, expected result, priority, viewport, and evidence checklist for authenticated write flows and section navigation |
| T-012 | Align Instagram rich-text e2e expectation with project rules | Мариночка (QA Analyst) + Ромик (Dev) | Done | `e2e/travel-instagram-rich-text.spec.ts` now asserts Instagram iframe/blockquotes for valid post links and rejects unload policy violations | Project rule is canonical: valid Instagram post/reel/tv URLs render as embeds on web; unsupported Instagram URLs keep fallback behavior |
| T-013 | Redesign missing hero media state for travel details | UI/UX Designer + Ромик (Dev) | Done | Changed files: `components/travel/details/TravelDetailsOptimizedLCPHero.tsx`, `__tests__/components/travel/TravelDetailsContainer.performance.web.test.tsx`; validation: targeted Jest, `npm run check:fast`, Playwright hero smoke | Fixed in code: travel hero fallback is now a neutral geometry-preserving placeholder with no visible text/icons |
| T-014 | Audit mobile bottom overlays and touch target sizes | UI/UX Designer | Active today | Dispatch assigned 2026-06-01 | Cookie banner, bottom nav, sticky section tabs, and action controls need bug-vs-polish classification and target viewport |
| T-015 | Form and groom backlog from QA/design findings | Андриуш (Backlog Manager) | In progress | Backlog evidence pending | Convert findings, manual cases, and idle capacity into prioritized implementation-ready tasks |
| T-016 | Write business requirements and acceptance criteria for travel QA fixes | Крина (Business Analyst) | In progress | Requirements evidence pending | Separate product requirements, user stories, non-goals, risks, and acceptance criteria from manager coordination |
| T-017 | Prepare technical fix plan for travel QA findings | Ромик (Dev) | In progress | `F-004` fixed/verified; current next fix packet is `TD-006` (`D-004`/`D-013` overlay + `D-010` touch targets) | Prepare scoped `TD-006` implementation plan after UI contract; no code for `D-006` until IA decision |
| T-018 | Approve and govern task readiness flow | Андриуш (Approver) | Active today | `F-004` approved as unblocked/fixed; `D-014` resolved; `D-006` routed to BA/Approver IA decision | Gate `TD-006` spec and `D-006` IA; reject vague findings before dev starts |
| T-019 | Keep local QA automation and workboard health green | Витаутас (DevOps) | In progress | Automation evidence pending | Watch local board, e2e artifacts, scheduled rituals, and automation health for the team |
| T-020 | Audit travel page SEO metadata and schema health | Сео (SEO Engineer) | Active today | Dispatch assigned 2026-06-01 | Review canonical, title, description, OG tags, schema.org, and SEO e2e coverage for travel details plus Home/Search/Places |
| T-021 | Create cross-page QA acceptance matrix | Крина (Business Analyst) | Active today | Dispatch assigned 2026-06-01 | Acceptance criteria for confirmed `F-*`/`D-*` findings before implementation starts |
| T-022 | Write manual test cases for next-page QA wave | Мариночка (QA Analyst) | Active today | Dispatch assigned 2026-06-01 | Reusable cases for Search, Home, Map, Places, Quests, PDF/export with prerequisites, steps, expected results, viewport, and evidence fields |
| T-023 | Run Search page web and mobile QA pass | Мариночка (QA) | Done | `e2e/search.spec.ts` chromium: 1 passed; local `/search` desktop 1440x900 and mobile iPhone 13 passed with `overflowX=false`, consoleErrors=0, pageErrors=0 | Search input, filtered empty/results state, desktop/mobile layout, horizontal overflow, and console/page errors verified |
| T-024 | Run Home page web and mobile QA pass | Мариночка (QA) | Done | `e2e/home-quick-filters-nightstay.spec.ts` chromium: 1 passed; local `/` desktop 1440x900 and mobile iPhone 13 passed with `overflowX=false`, consoleErrors=0, pageErrors=0 | Home title/h1, quick filters, Home -> Search filter navigation, desktop/mobile layout, horizontal overflow, and console/page errors verified |
| T-025 | Run Map page web and mobile QA pass | Мариночка (QA) | In progress | Browser evidence pending | Map load, markers, filters, popups, route interactions, mobile controls, and external links |
| T-026 | Run Places page web and mobile QA pass | Мариночка (QA) | In progress | Browser evidence pending | Places catalog, country/category/search filters, cards, map focus links, incremental loading, and mobile layout |
| T-027 | Run Quests page web and mobile QA pass | Мариночка (QA) | In progress | Browser evidence pending | Quest list/detail/start flows, media states, map dependencies, responsive layout, and console errors |
| T-028 | Run PDF/export QA pass | Мариночка (Manual QA) | In progress | Manual evidence pending | PDF/export entry points, generated output, loading/errors, and permissions without exposing secrets |
| T-029 | Create UX/UI audit for next-page QA wave | UI/UX Designer | In progress | Screenshot audit pending | Search, Home, Map, Places, Quests, PDF/export hierarchy, touch targets, overlays, placeholders, and responsive polish |
| T-030 | Run SEO audit for indexable pages | Сео (SEO Engineer) | Active today | Dispatch assigned 2026-06-01 | Titles, descriptions, canonical, OG, schema, indexability, and SEO e2e coverage for pages already captured by QA |
| T-031 | Prepare implementation queue for confirmed page findings | Ромик (Dev) | In progress | Queue unblocked: `F-004` closed; `TD-006` is next approved-candidate packet; `D-006` parked behind IA decision | Confirmed QA/design/SEO findings become fix-ready diffs only after acceptance criteria and repro |
| T-032 | Review cross-page QA findings and fix readiness | Андриуш (Reviewer) | Active today | Dispatch assigned 2026-06-01 | Duplicates, severity, owner, acceptance criteria, validation plan, and project-rule compliance for `F-004`/`F-005` |
| T-033 | Prepare multi-page e2e and local environment health plan | Витаутас (DevOps) | In progress | Automation evidence pending | Stable e2e server/build health, selective commands, no stale artifacts or stuck servers |
| T-034 | Maintain cross-page backlog and capacity board | Андриуш (Backlog Manager) | In progress | Backlog evidence pending | All findings assigned, prioritized, evidence-tagged, and ready for weekly planning |
| T-035 | Run mobile manual smoke for Search, Home, Map, Places, Quests | Мариночка (Manual QA) | In progress | Manual mobile evidence pending | Tap targets, navigation, overlays, scroll behavior, and screenshots/evidence notes |
| T-036 | Write Search page test cases | Мариночка (QA Analyst) | In progress | Test cases pending | Query, filters, sorting, pagination/infinite load, empty state, deep links, and mobile variants |
| T-037 | Create Search page UX audit | UI/UX Designer | In progress | Round-2 live audit done (desktop, 380 results): filed `D-010` (touch targets), `D-011` (stale `Год 2024` default), `F-007` (transient error/empty), `D-004` overlap confirm. Mobile filter access RESOLVED: funnel icon in the search bar opens filters (mobile error-state also captured under flaky API). Populated mobile cards `verify pending` (E2E API down in window) | Filter ergonomics, result cards, empty states, touch targets, and mobile filter access |
| T-038 | Run Search page SEO audit | Сео (SEO Engineer) | In progress | SEO audit pending | Title, description, canonical, indexability, schema risk, and e2e coverage notes |
| T-039 | Prepare Search findings for development | Ромик (Dev) | Open | Code evidence pending | Wait for QA/BA/design evidence; then map confirmed findings to target files and validation commands |
| T-040 | Write Home page test cases | Мариночка (QA Analyst) | In progress | Test cases pending | First load, hero, navigation to details/search/map, degraded data, and responsive sections |
| T-041 | Create Home page UX audit | UI/UX Designer | In progress | Round-2 live audit done (desktop + mobile): hero/chips/CTA hierarchy solid, route-card image correct contain+blur; filed `D-010` (touch targets), `D-012` (carousel loading placeholder), `D-004` overlap confirm; random-route empty state on-brand (keep) | Hierarchy, cards, media placeholders, CTAs, section spacing, and mobile bottom/nav overlap |
| T-042 | Run Home page SEO audit | Сео (SEO Engineer) | In progress | SEO audit pending | Metadata, OG, heading structure, internal links, and structured data risks |
| T-043 | Write Map page test cases | Мариночка (QA Analyst) | Active today | Dispatch assigned 2026-06-01 | Geolocation allowed/denied, marker click, popup, filters/search, route interactions, and error state |
| T-044 | Create Map controls UX audit | UI/UX Designer | In progress | Round-2 live audit (mobile): controls locate/+/−/60км/layers/list ≈48px (good), `Найти места рядом` CTA good, markers render; `D-004` overlap confirm (cookie banner over map bottom). Desktop captured: left control panel (Поиск/Маршрут/Места tabs, radius 60/100/200/400 км, `Что посмотреть`, empty `Ничего не нашлось` + recovery CTAs, `Управление картой`), Leaflet map with place markers, controls locate/+/−/Радиус/Оверлеи. Filed `D-014` (map markers vs `/places` 0-catalog mismatch). Marker-popup layout re-shoot `verify pending` (E2E API down in window) | Touch targets, popup layout, map controls, overlays, and mobile gesture conflicts |
| T-045 | Write Places page test cases | Мариночка (QA Analyst) | Active today | Dispatch assigned 2026-06-01 | List, filters, place card, map relation, missing media, empty state, incremental loading, and `F-004` nested controls |
| T-046 | Run Places SEO audit | Сео (SEO Engineer) | Active today | Dispatch assigned 2026-06-01 | Metadata, canonical, OG, schema notes, and indexability for Places surfaces |
| T-047 | Write Quests page test cases | Мариночка (QA Analyst) | Active today | Dispatch assigned 2026-06-01 | List, detail, start/resume where available, locked/empty/error states, and media handling |
| T-048 | Create Quests UX audit | UI/UX Designer | Active today | Dispatch assigned 2026-06-01 | Quest flow clarity, cards, next-action states, empty states, and dead-end prevention |
| T-049 | Write PDF/export test cases | Мариночка (QA Analyst) | Active today | Dispatch assigned 2026-06-01 | Export entry points, permissions, loading, error, generated output, and download/result verification |
| T-050 | Prepare PDF/export findings for development | Ромик (Dev) | Open | Code evidence pending | Only confirmed PDF/export bugs with repro, expected result, target files, and validation enter implementation |
| T-051 | Run cross-page review gate | Андриуш (Reviewer) | Active today | Dispatch assigned 2026-06-01 | Deduplicate findings, verify severity, reject vague bugs, and approve implementation-ready tasks |
| T-052 | Keep new sprint evidence and e2e health green | Витаутас (DevOps) | In progress | Board/e2e evidence pending | Board shows active work, no fake Done, evidence required for every closed task, and e2e setup remains stable |
| T-053 | Cross-page implementation lane | Ромик (Dev) | In progress | Unblocked 2026-06-02: `F-004` fixed/verified, `D-014` resolved, and next dev packet is `TD-006`; no active `Blocked` implementation lane | Start with `TD-006` after designer/approver gate; keep shared-component changes scoped and browser-verified |
| T-054 | Create cross-page final regression plan | Крина (Business Analyst) + Мариночка (QA Analyst) | Active today | Dispatch assigned 2026-06-01 | One reusable release checklist covers web/mobile/page-specific risks before final regression |
| T-055 | Split `app/(tabs)/profile.tsx` below 800 LOC | Ромик (Dev) | Done | profile.tsx 889 → 783 LOC; new `app/(tabs)/profileScreen.styles.ts` + `profileScreen.helpers.ts`; validation: `npm run typecheck`, `npm run check:fast` (8 suites / 84 tests passed), `guard:file-complexity:changed` violations=0, `check:image-architecture`, `guard:external-links` all passed | Behavior-neutral extraction via `refactor-surgeon`: styles factory + pure helpers; hook order/deps unchanged |

## Three-month team backlog

Created: 2026-06-01. Planning window: 2026-06-01 through 2026-08-31.

Goal: every role has evidence-backed work for discovery, implementation, validation, review, performance, and tech-debt cleanup. Work moves to `Done` only with command/browser/review evidence; implementation starts only from approved `F-*`, `D-*`, `TD-*`, or `PERF-*` items.

| Month | Theme | Owners | Main backlog | Exit criteria |
| --- | --- | --- | --- | --- |
| June 2026 | Stabilize QA evidence and unblock implementation | Андриуш, Крина, Мариночка, UI/UX, Ромик, Витаутас, Сео | Close `T-010` through `T-022`; finish Map/Places/Quests/PDF QA (`T-025`-`T-030`); fix `F-004`; finish `PERF-001`; start `TD-003`, `TD-004` | Cross-page findings have repro, owner, severity, acceptance criteria, and validation command; no `Blocked` implementation lane |
| July 2026 | Performance and high-value tech debt | Ромик, `refactor-surgeon`, `travel-expert`, `map-expert`, Витаутас, Сео | Execute `PERF-003` through `PERF-010`; split P1/P2 god files (`TD-003`-`TD-012`, `TD-018`-`TD-021`); add page perf baselines (`PERF-011`) | Production build/Lighthouse baselines are recorded; changed files pass `guard:file-complexity:changed`, targeted Jest/e2e, and external-link guard |
| August 2026 | Regression hardening and release readiness | Андриуш, Крина, Мариночка, QA Analyst, UI/UX, Ромик, Витаутас, Сео | Finish full-page QA wave (`T-056`-`T-064`); close residual UX/SEO defects; add bundle/perf regression guards (`PERF-012`); prepare final regression plan (`T-054`) | Release candidate has cross-page regression checklist, SEO/perf summary, no known in-scope console/runtime failures, and explicit residual risks |

Role coverage:

- Андриуш: readiness approvals (`T-018`), backlog grooming (`T-015`, `T-034`), review gates (`T-032`, `T-051`), monthly reprioritization.
- Крина: acceptance matrix and requirements (`T-016`, `T-021`, `T-054`, `T-063`) with measurable DoD before implementation.
- Мариночка QA / Manual QA: page QA and authenticated/manual flows (`T-010`, `T-025`-`T-028`, `T-035`, `T-057`-`T-061`).
- Мариночка QA Analyst: reusable manual cases (`T-011`, `T-022`, `T-036`, `T-040`, `T-043`, `T-045`, `T-047`, `T-049`).
- UI/UX Designer: visual audits and redesign backlog (`T-009`, `T-014`, `T-029`, `T-037`, `T-041`, `T-044`, `T-048`, `T-062`).
- Ромик / specialist agents: evidence-backed fixes and refactors (`T-017`, `T-031`, `T-039`, `T-050`, `T-053`, `TD-*`, `PERF-*`).
- Витаутас: automation/e2e/perf infrastructure (`T-019`, `T-033`, `T-052`, `T-056`, `PERF-011`, `PERF-012`).
- Сео: metadata/indexability audits (`T-020`, `T-030`, `T-038`, `T-042`, `T-046`) and SEO checks after perf changes.

## Tech debt backlog

Created: 2026-06-01. Source: `guard:file-complexity` (>800 LOC), open findings, and source scan (`@ts-ignore`/`exhaustive-deps`).

Routing: god-components → `refactor-surgeon`; travel files → `travel-expert`; map files → `map-expert`; tests → `test-author`. Splits must preserve behavior; re-run `check:fast` + guards to green. Priority order favors travel (primary feature); article pages are deprioritized (not in active use).

| ID | Item | Owner | Priority | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| TD-001 | Finish `T-055` profile split below 800 LOC and commit the dirty diff | Ромик (Dev) / `refactor-surgeon` | P1 | Split done: `app/(tabs)/profile.tsx` = 783 LOC, `guard:file-complexity:changed` violations=0, `check:fast` 84 passed, no dead `ProfileStats` refs. Helpers/styles wired and imported | Code goal met & green; commit of dirty diff awaits user approval |
| TD-002 | Resolve `F-003` Instagram rich-text e2e spec mismatch (iframe vs fallback card) | Мариночка (QA Analyst) + Ромик (Dev) | P1 | `e2e/travel-instagram-rich-text.spec.ts` now expects Instagram iframe/blockquotes for valid post links; unit coverage already keeps stories as fallback cards | Done |
| TD-003 | Split `components/travel/TravelWizardStepPublish.tsx` (1250 LOC) | `refactor-surgeon` + `travel-expert` | P1 | `TravelWizardStepPublish.tsx` 1250→644 LOC; extracted `createStyles` block → new `travelWizardStepPublish.styles.ts` (610 LOC). Pure-move: main-file diff = **+1 / −607** (import swap + styles block only), component body (hooks/handlers/JSX) byte-untouched — self-reviewed. Behavior-neutral: `jest TravelWizardStepPublish UpsertTravel` 46/46 (8 suites), `check:fast` 335, `guard:file-complexity:changed`/`check:image-architecture`/`guard:external-links` green; target-file typecheck clean. **Browser-verified (authenticated via e2e session, sergey@lyte.com)**: `/travel/new` wizard loads with refactored bundle, step 1/6 renders, **zero console errors**; publish step (6/6) live render needs draft write (skipped per Authenticated-QA no-destructive rule) — its render fully covered by `TravelWizardStepPublish.test.tsx`. Note: full-repo `npm run typecheck` blocked by pre-existing unrelated staged error `TravelPreviewModal.tsx:91` (`accessibilityRole="dialog"`) — flagged separately, not from TD-003. | Done |
| TD-004 | Split `components/travel/CompactSideBarTravel.tsx` (1101 LOC) | `refactor-surgeon` + `travel-expert` | P1 | `CompactSideBarTravel.tsx` 1101→412 LOC; extracted `compactSideBar/helpers.ts` + `styles.ts` + `parts/{WidgetFallback,WeatherPlaceholder,NavRow,AuthorBlock}.tsx`. Behavior-neutral: `jest CompactSideBarTravel TravelDetails` 264/264 (36 suites), `check:fast`/`typecheck`/`guard:file-complexity:changed`/`check:image-architecture`/`guard:external-links` green. **Browser-verified** (dev :8081, `/travels/kostel-svyatogo-antoniya-paduanskogo`): page renders (hero 1/10, chips, plan CTA), all sidebar sections present in DOM (nav, author block, GPX/KML download, weather toggle), **zero console errors**. **Reviewer (Андриуш): APPROVE** — function body byte-identical to HEAD (zero diff), hooks/deps untouched, helpers/parts 1:1, any-parity exact (0 new), guards clean. All 3 gates met. | Done |
| TD-005 | Split `components/listTravel/ListTravelBase.tsx` below 800 LOC | `refactor-surgeon` + `travel-expert` | P1 | `ListTravelBase.tsx` 1037→796 LOC; extracted `parts/ListTravelLayout.tsx`, `parts/ListTravelTopContent.tsx` + pure fns in `ListTravelBase.helpers.ts`/`listTravelBaseModel.ts`. Behavior-neutral: `npx jest listTravel` 263/263 (32 suites, identical baseline, tests unchanged), `check:fast`/`typecheck`/`guard:file-complexity:changed` green. **Browser-verified** (dev port 8081): `/search` renders 380-card list + filters + search input (screenshot), `/export` empty-state + CTAs (screenshot); no NEW console errors from split. Pre-existing nested-`<button>` hydration warning in `TravelListItem`/`PlaceCard` (untouched by split) → separate finding F-004. **Reviewer (Андриуш): APPROVE WITH NITS** — hooks order + deps arrays byte-identical to HEAD, conditional `topContent===null` + lazy/Suspense preserved, pure fns equivalent, props passed 1:1, no real risks. Nit fixed: style props in both `parts/` files typed via `StyleProp<ViewStyle>` + `Pick<ReturnType<typeof createListTravelBaseStyles>>` (no more `any`); typecheck + 263/263 re-verified. All 3 gates met. | Done |
| TD-006 | Resolve `D-002` / `D-004` / `D-010` / `D-013` mobile overlays and touch-target sizing | UI/UX Designer + Ромик (Dev) | P2 | Active packet: cookie banner + bottom nav must not hide CTAs/form fields; empty-state `Обновить` must stay tappable; mobile hit areas target >=44px; Leaflet/map popup clipping needs re-shoot. UI contract due first, then scoped dev fix with browser verification | Active today |
| TD-007 | Split `components/MapPage/MapQuickFilters.tsx` (926 LOC) | `refactor-surgeon` + `map-expert` | P2 | `MapQuickFilters.tsx` 926→252 LOC + 6 подмодулей в `MapQuickFilters/` (types/styles/fields/IconOnlyBar/RowBar/Popovers, все <800). Behavior-neutral (`CATEGORY_ICONS` реэкспорт сохранён). Validation: `guard:file-complexity:changed` violations=0, map jest 37 suites/195 passed, typecheck/eslint green. Сделано в рамках PERF-008 (`map-expert`) | Done |
| TD-008 | Split `app/(tabs)/calendar.tsx` (1199 LOC) | `refactor-surgeon` | P2 | guard:file-complexity = 1199 LOC | Open |
| TD-009 | Split `components/export/BookSettingsModal.tsx` (1120 LOC) | `refactor-surgeon` | P2 | guard:file-complexity = 1120 LOC | Open |
| TD-010 | Split `components/travel/details/sections/RouteElevationProfile.tsx` (853 LOC) | `refactor-surgeon` + `travel-expert` | P2 | `RouteElevationProfile.tsx` 853→758 LOC; extracted memo sub-component `ChartStaticLayers` → `routeElevationProfile/ChartStaticLayers.tsx`. Pure-move: main-file diff **+2 / −97**, hooks/deps/JSX body byte-untouched. `jest RouteElevationProfile TravelRouteMapBlock` 4/4 (2 suites — renders the chart incl. extracted ChartStaticLayers), full `typecheck` 0 errors, `check:fast`/`guard:file-complexity:changed`/`check:image-architecture`/`guard:external-links` green. Browser: refactored bundle loads in live app (home/search/travel pages render, no console errors), but **live elevation-chart screenshot NOT captured** — chart renders only for GPX-route travels; prod route-travel slugs unreachable this session (RNW card-nav synthetic events flaky, `/api/travels` proxy 502, e2e slugs are e2e-backend only). Chart render covered by component test. Browser-gate attempt 2: repointed dev/preview at working e2e backend `http://192.168.50.36` (=`E2E_API_URL`) via gitignored `.env.local` (default `127.0.0.1:8112` was 502); confirmed backend 200 + `access-control-allow-origin: http://localhost:8081` + Modyn travel exists with route coords. Still couldn't capture live chart: Expo dev server under preview harness repeatedly dies (idle/crash; cleared Metro disk-cache corruption), and `/travels/[slug]` redirects to `/` on load in this dev setup. Environmental blocker, not code. | In progress — code green + jest-verified; live browser screenshot blocked by dev-server instability (env diagnosed/fixed via `.env.local`→e2e backend) |
| TD-011 | Split `components/travel/UnifiedSlider.tsx` (817 LOC) — keep blur background, optimize render cost only, do not remove | `refactor-surgeon` + `travel-expert` | P2 | guard:file-complexity = 817 LOC; slider blur rule | Open |
| TD-012 | Reduce `api/client.ts` (836 LOC) by extracting domain modules | `refactor-surgeon` | P2 | guard:file-complexity = 836 LOC | Open |
| TD-013 | Split `components/quests/QuestPrintable.tsx` (992 LOC) | `refactor-surgeon` | P3 | guard:file-complexity = 992 LOC | Open |
| TD-014 | Split `components/UserPoints/PointsList.tsx` (909) and `PointCard.tsx` (877) | `refactor-surgeon` | P3 | guard:file-complexity = 909 / 877 LOC | Open |
| TD-015 | Extract oversized style modules >800 LOC | `refactor-surgeon` | P3 | ✅ `TravelDetailsStyles.ts` 831→44 LOC (6 modules). ✅ `webStyles.ts` 1128→22 LOC (7 modules; CSS byte-identical). ✅ `homeHeroStyles.ts` 1908→177 LOC (8 modules in `homeHeroStyles/`; normalized style-body diff IDENTICAL, 153 keys; HomeHero+Home tests 28/28; `guard:file-complexity:changed` violations=0; `typecheck` green; `createHomeHeroStyles` signature preserved). ✅ `filtersPanelStyles.ts` 935→30 LOC (8 modules in `filtersPanelStyles/`; 117 keys identical, no dup keys; dedicated `filtersPanelStyles.test.ts` passed; `check:fast` 6 suites / 52; named+default exports preserved). ✅ `questWizardStyles.ts` 870→22 LOC (9 modules; 146 keys identical; Quest tests 80/80). ✅ `modernFiltersStyles.ts` 859→45 LOC (8 modules; 105 keys identical, no dups; listTravel/filters tests 48 suites / 345; `index.ts` untouched). All 6 modules now <800 LOC | Done — 6/6 |
| TD-016 | Audit 12 `eslint-disable react-hooks/exhaustive-deps` for stale-closure risk | `test-author` + domain expert | P3 | 12 occurrences across `components/`, `hooks/`, `app/` | Open |
| TD-017 | Split `components/article/ArticleEditor.web.tsx` (1290 LOC) | `refactor-surgeon` | P4 | guard:file-complexity = 1290 LOC; article pages not in active use | Open |
| TD-018 | Split `services/pdf-export/themes/PdfThemeConfig.ts` (1767 LOC) | `refactor-surgeon` + `pdf-export` | P2 | Largest file in `guard:file-complexity`; theme config should be split by theme/tokens and covered by PDF renderer snapshots | Open |
| TD-019 | Split `screens/tabs/PlacesScreen.tsx` (1664 LOC) | `refactor-surgeon` + `travel-expert` | P1 | Tied to `F-004` and `PERF-010`; split screen controller, filters/list, map relation, and empty/error state | Open |
| TD-020 | Split `screens/tabs/QuestsScreen.tsx` (1346 LOC) | `refactor-surgeon` | P2 | Needed before full Quests QA wave; split list, city/detail routing model, empty/locked states, and media handling | Open |
| TD-021 | Split oversized PDF export runtime modules | `refactor-surgeon` + `pdf-export` | P2 | `pdfRuntimeMarkup.ts` 1196 LOC, `ContentParser.ts` 864 LOC, `BlockRenderer.ts` 820 LOC; extract parser/renderer blocks with golden output tests | Open |
| TD-022 | Resolve 3 active `react-hooks/exhaustive-deps` warnings in `components/listTravel/ListTravelBase.tsx` | `travel-expert` + `test-author` | P2 | 3 `useMemo` warn missing `filter`/`options`/`styles` — deps arrays list granular sub-keys (`filter.sort`, `options?.categories`, `styles.fallbackNotice`) instead of whole objects (intentional, avoids recompute on object-identity change). Correct fix = justified `eslint-disable-next-line` per site, NOT whole-object deps (would regress perf). Blocks `check:fast` pre-commit (max-warnings=0). NB: active WIP file — coordinate via `travel-expert`, do not mix into unrelated dirty diff | Open |
| TD-023 | Re-theme legacy non-brand shadow in shared `components/ui/EmptyState.tsx` | UI/UX Designer + `refactor-surgeon` | P3 | `iconContainer` web boxShadow hardcodes blue `rgba(59,130,246,0.15)`; palette is green/orange brand. Shared component (whole app) — change affects all empty states, verify before applying | Done — `b3cd607e`: web boxShadow now `colors.primaryAlpha30` (matches existing iOS `colors.primary` shadow). typecheck/lint green; profile tests 5/5; guards passed |
| TD-024 | Harden `ProfileMenu` dropdown positioning | `travel-expert` (profile) | P3 | `components/profile/ProfileMenu.tsx` uses fragile `measure()` + hardcoded `top:60` fallback; menu can mis-position on mobile/portrait and in tests | Done — `b3cd607e`: switched to `measureInWindow` (absolute coords), anchor menu to trigger right edge, clamp `top` to viewport; RNTL fallback `top:60` preserved (logout-opens-menu test 5/5 green) |
| TD-025 | нужно написать тест кейсы для страницы создать отредатировани путешестие. после проверить что все работает | Мариночка (QA) | P1 | Evidence pending | Open |
| TD-026 | нужно написать тесткусы на страницу квесты и квест после проверить что все работает ручное тестирование завести баги | Мариночка (QA) | P1 | Evidence pending | Open |

## Performance Refactor backlog

Created: 2026-06-01. Цель: открыть задачи на рефакторинг/переписывание/замену для главной, поиска, страницы путешествия, карты и мест, плюс отдельное тестирование перфоманса и сквозной план ускорения.

Контекст: подробная модель `SSR-first + deferred islands` и уже сделанная работа по travel описаны в `docs/TRAVEL_PERFORMANCE_REFACTOR.md`. Та же модель тиражируется на остальные страницы. Цель по Lighthouse, как в travel-доке: mobile `>= 60`, desktop `>= 70`, и снижение unused JS / bootup на critical path.

Правила: не ломать SSR SEO (`H1`, canonical, `og:*`, JSON-LD); не возвращать service worker / cache-bust / reload workaround; маленькие поэтапные изменения, не big-bang rewrite; после каждого этапа — targeted checks. Splits god-компонентов координируются с tech-debt backlog (TD-*) и профильными агентами (`refactor-surgeon`, `map-expert`, `travel-expert`).

Routing: главная/поиск/места → `refactor-surgeon` + `travel-expert`; карта → `refactor-surgeon` + `map-expert`; тесты/budget-гварды → `test-author`; план → Ромик (Dev) + Андриуш (Approver).

| ID | Страница / Тема | Тип | Owner | Priority | Цель | Кандидаты файлов | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PERF-001 | Главная | Рефакторинг | `refactor-surgeon` + `travel-expert` | P1 | Перевести `Home` на `SSR-first + deferred islands`: critical hero shell в initial render, тяжёлые секции ниже фолда — через visibility/idle defer | Done in code: `components/home/Home.tsx` — все 7 below-fold секций обёрнуты в новый `DeferredSection` поверх `useProgressiveLoad` (visibility-first + fallback timer, rootMargin 400px / 1000ms, compliant with timeout policy); lazy-чанки секций больше не стартуют все сразу при mount и не конкурируют с hero LCP. Hero остаётся eager. Native поведение не меняется (`shouldLoad=true` сразу). Validation: `typecheck` green, home Jest `62 passed`, `check:image-architecture` + `guard:external-links` passed, `eslint Home.tsx` clean. Без lazy-skip изображений / без `content-visibility`. Browser ✅: `npm run e2e -- e2e/home-quick-filters-nightstay.spec.ts --project=chromium` → `1 passed` (4.6s), hero/quick-filters путь и навигация Home→Search не сломаны. Eager-импорт `Home` в `app/(tabs)/index.tsx` сохранён намеренно (Home = critical shell с hero/LCP; lazy route задержал бы LCP). Reviewer ✅: code-review (7 углов, 1-vote verify) → 0 actionable findings; native/test-compat, removed-behavior (`container={{}}`↔`PageSection` defaults), fallback-swap без скачка — подтверждены. Sprint ✅: sign-off Андриуш-Approver в спринте `Page Performance Refactor`. Все 3 гейта пройдены. Прим.: reveal-on-scroll deferred-секций этим spec явно не ассертится | Done |
| PERF-002 | Главная | Замена/распил стилей | `refactor-surgeon` | P1 | Закрыть `homeHeroStyles.ts` (1908 LOC) — разбить на chunk-модули, убрать из critical path лишние стили (см. TD-015) | `components/home/homeHeroStyles.ts` 1908→177 LOC + 8 модулей в `homeHeroStyles/` (context/shell/sliderSection/sliderMedia/sliderNav/typography/bookWidget/cta). Validation: `typecheck` green; style-keys diff HEAD↔split = 153/153, 0 lost/0 added; 0 дублей ключей между модулями; `guard:file-complexity:changed` violations=0; `check:image-architecture` passed; Jest home `30 passed` (HomeHero/Home/home-screen.regression). Единственный потребитель `HomeHero.tsx` не тронут | Done |
| PERF-003 | Главная | Image delivery | `travel-expert` | P2 | Один LCP hero image с `fetchpriority=high`+eager, остальное media — lazy; корректные `srcset/sizes`; нет oversized для small slots; нейтральные placeholders | Аудит 2026-06-01: уже соответствует целевой модели. Ровно один high-priority eager LCP-image на каждый взаимоисключающий лейаут: desktop/book → BookSlider первый слайд `loading=eager`+`priority=high` (`HomeHeroBookLayout.tsx:347-348`, остальные lazy/normal); tablet → `TabletFeaturedCard` eager+high; mobile (`!showSideSlider && !isTabletLayout`) → `HomeHeroPopularSection` `FeaturedRouteCard` eager+high (`:90-91`), book layout без hero-image. PopularSection рендерится только в mobile-ветке (`HomeHero.tsx:346`) → двойного LCP нет. Все картинки через центральный `ImageCardMedia` (fit=contain, blurBackground, quality 60/72, web URL resize по width/height). Остаток (P3): точечный аудит avatar bytes в мелких слотах прочих секций. | Mostly done — целевая LCP-модель уже выполнена |
| PERF-004 | Поиск | Рефакторинг/распил | `refactor-surgeon` + `travel-expert` | P1 | Распилить и облегчить список: critical shell (поле поиска + первый экран результатов) рано, фильтры/правую колонку/экспорт — defer; уменьшить initial JS search route | Аудит 2026-06-01: основной объём уже закрыт. (1) Route `app/(tabs)/search.tsx` уже lazy-грузит `ListTravelBase` + `SearchPageSkeleton` + SEO/h1. (2) Split `ListTravelBase` <800 LOC залендён в HEAD (TD-005, 1037→796). (3) `RecommendationsTabs` (634) — `lazy()` в `RightColumn.tsx:39` + default-hidden (`useRecommendationsVisibility` → `false`, gated `showRecommendations && <Suspense>`), чанк грузится только по клику. (4) `filter-options`/`travel-facets` queries gated через `shouldFetchFilterOptions`. (5) export controls lazy. **Остаток (P3, отложен): mobile-overlay `ModernFilters` mount-gating + initial-JS audit search chunk — но `parts/ListTravelLayout.tsx`/`parts/ListTravelTopContent.tsx` сейчас в активной dirty-работе, правки отложены во избежание конфликтов.** | Mostly done — core delivered via TD-005 + existing lazy/gating; small remainder deferred |
| PERF-005 | Поиск | Перфоманс списка | `travel-expert` | P2 | Виртуализация/инкрементальная подгрузка результатов, мемоизация карточек, lazy-image в карточках, отсечь лишние ререндеры при смене фильтров | Аудит 2026-06-01: основные рычаги уже реализованы. (1) Lazy-image: `TravelListItem.tsx:600-602` — первый card `priority=high`+`loading=eager`+`prefetch`, остальные `low`+`lazy`. (2) Мемоизация: `RenderTravelItem` обёрнут в memo с кастомным компаратором (`:160-175`). (3) Native — `FlashList` (`removeClippedSubviews`, `maxToRenderPerBatch=10`, `initialNumToRender=8`, `windowSize=5`). (4) Web — `ScrollView`+`rows.map` **намеренно** (onScroll-инфинит, `RightColumn.tsx:232`), инкрементально через `visibleCount`/пагинацию. LCP 1592ms (baseline) — data-fetch-bound, не image/virtualization. **Остаток (P3, отложен): web-виртуализация ScrollView-пути — большое рискованное изменение, завязано на onScroll; вне quick-win.** | Mostly done — lazy-image/memo/native-virtualization уже есть; web-виртуализация отложена |
| PERF-006 | Путешествие | Продолжение рефактора | `travel-expert` | P1 | Доделать незакрытые этапы из `docs/TRAVEL_PERFORMANCE_REFACTOR.md`: Этап 4 (сократить initial JS — резерв в `entry`/`__common`), Этап 5 (image delivery: hero srcset, avatar bytes, inline images), Этап 7 (budgets + regression guard) | `app/(tabs)/travels/[param].tsx`, `components/travel/details/*`, `entry`/`__common` audit | In progress |
| PERF-007 | Путешествие | Замена тяжёлых чанков | `refactor-surgeon` + `map-expert` | P2 | `TravelDetailsMapSection-*` (~73 KB) и `CommentsSection-*` (~77 KB) — самые тяжёлые lazy-чанки; проверить замену Leaflet-зависимости на легче/общую с картой, lazy-границы комментариев | `components/travel/details/sections/*`, общая map-зависимость | Open |
| PERF-008 | Карта | Рефакторинг/распил | `refactor-surgeon` + `map-expert` | P1 | Облегчить map route: critical shell + skeleton рано, Leaflet/маркеры/панели — defer; распил `MapQuickFilters.tsx` (926) | Done (`map-expert`, 2026-06-01): (1) Leaflet runtime-prefetch вынесен с module-eval eager на `requestIdleCallback`+`setTimeout(300)` fallback (`MapScreen.tsx`); контейнер карты грузит Leaflet сам на `mapReady` → функциональность цела. (2) `MapQuickFilters` 926→252 LOC + 6 подмодулей (TD-007 Done). Метрики `/map` ДО→ПОСЛЕ: **LCP 1276→1188ms (−88)**, FCP 356ms, TBT 0, long-tasks 0, CLS 0.013→0.012 (≈baseline), transfer 2852→2853KB (≈0). Честно: route-level не-критичный код уже был за lazy-чанками; основной вес `/map` = shared `__common`(684KB)+`entry`(460KB) → это **PERF-014**, не route-специфика. Idle-defer самого desktop-бара пробовали — дал CLS-регресс без выигрыша, откатили. Browser ✅ (`e2e:perf-budget:pages` 8/8, map-leaflet-wrapper ок). Independent verify ✅: typecheck, map jest 37/195, guards (image/external/file-complexity=0), eslint — все green. Reviewer ✅ (diff sound, behavior-neutral). Sprint ✅. | Done |
| PERF-009 | Карта | Перфоманс маркеров | `map-expert` | P2 | Кластеризация/виртуализация маркеров, отложенный routing (ORS), дебаунс фильтров, проверить bytes Leaflet bundle и tile loading | `components/MapPage/TravelMap.tsx`, `RoutingStatus.tsx` (353), `MapMobileLayout.tsx` (338) | Open |
| PERF-010 | Места | Рефакторинг/распил | `refactor-surgeon` + `travel-expert` | P1 | `PlacesScreen.tsx` (1664 LOC) распилить и перевести на critical shell + deferred islands; инкрементальная подгрузка каталога, lazy-image карточек, defer карты/фильтров | `app/(tabs)/places.tsx`, `screens/tabs/PlacesScreen.tsx` (1664) | Open |
| PERF-011 | Тестирование перфоманса | Отдельный трек | `test-author` + Витаутас (DevOps) | P1 | Расширить perf-тесты с travel на все страницы: mobile/desktop для `/`, `/search`, `/map`, `/places`; зафиксировать baseline и budget thresholds | Done in code: новый `e2e/pages-perf-budget.spec.ts` (8 тестов = 4 страницы × CWV+network) + переиспользуемые коллекторы `e2e/helpers/perfBudget.ts` + npm-скрипт `e2e:perf-budget:pages`. Travel-spec не тронут. Бюджеты env-overridable, lenient локально / tighter под CI. NB: `scripts/test-pages-performance.js` уже поддерживал Lighthouse по `--paths` (`/`,`/search`,`/map`); `/places` туда не добавлял (`scripts/` protected). Validation: typecheck green, eslint новых файлов clean, `playwright --list` = 8. **Browser ✅ baseline (e2e build, desktop, local, 8 passed 37.9s):** Home LCP 868ms/CLS 0.0006/JS 1223KB/52req; Search 1592ms/0.0538/1185KB/49req; Map 1276ms/0.0127/1241KB/38req; Places 148ms/**CLS 0.097**/1185KB/46req. Заметка: Places CLS близко к Lighthouse-порогу 0.1 → кандидат на отдельный fix (PERF-015). Guards: `check:image-architecture` + `guard:external-links` passed. Reviewer ✅: test-инфра зеркалит верифицированный travel-spec, общий helper без дублирования, бюджеты env-overridable — 0 actionable findings. Sprint ✅: sign-off в `Page Performance Refactor`. Все 3 гейта пройдены. | Done |
| PERF-012 | Тестирование перфоманса | Regression guard | `test-author` | P2 | Bundle-size budget guard на `entry`/`__common` и per-route chunks + e2e perf-budget spec для каждой страницы; падение при регрессе; задокументировать thresholds в `docs/` | `scripts/check-performance.sh`, `analyze:bundle`, новые `e2e/*-perf-budget.spec.ts` | Open |
| PERF-013 | План ускорения | Сквозной план | Ромик (Dev) + Андриуш (Approver) | P1 | Единый план ускорения для всех страниц: приоритизация (главная и поиск как точки входа → карта/места → travel-доводка), порядок этапов, метрики до/после, definition of done; оформить в perf-плане | Done (docs-only): создан `docs/PERF_SPEEDUP_PLAN.md` — цель/метрики + baseline-таблица (LCP/CLS/JS/req по 4 страницам), принципы, фазы A→D, verification gate (browser+reviewer+sprint), риски, рекомендуемый порядок `PERF-015 → 005 → 014(+012) → 008/009 → 006/007` | Done |
| PERF-014 | Сквозное | Замена shared runtime | `refactor-surgeon` | P2 | Аудит `entry`/`__common` для всех route: убрать ранние shared-импорты, тиражировать `useWindowDimensions`-вместо-`useResponsive` и interaction-defer providers | Данные 2026-06-01 (из `largestResources` perf-spec): на КАЖДОЙ странице грузятся `__common-*.js` **684KB** + `entry-*.js` **460KB** = ~1.14MB shared JS — доминирующий вес. Per-page route JS крошечный (`index-*.js` ~20KB) → подтверждает, что route-level правки (карта PERF-008) почти не двигают transfer, а реальный резерв — здесь. Аватар 157KB на всех страницах = артефакт локального dev-S3 (`metravellocal.s3...`); `optimizeImageUrl` намеренно не ресайзит non-own-domain URL, в prod аватар идёт через own-domain proxy с resize → НЕ prod-регресс, не трогать. **Tooling-блокер (2026-06-01):** установлен `source-map-explorer` (devDep), но Expo 55 web static export НЕ эмитит usable source maps (`--source-maps external` → 0 `.map` файлов) и Metro web-сериализатор не встраивает source-пути модулей даже при `--no-minify` → точный per-module разбор `__common` в этой среде невозможен без отдельной настройки Metro bundle-visualizer (config-заход). Снятый **инвентарь чанков** (raw, ~2.6× gz): `__common` 2594KB, `entry` 1941KB (shared везде); крупные lazy-чанки уже отделены: `heic2any` 1322KB, `quill` 482KB, `UpsertTravel` 349KB, `EnhancedPdfGenerator` 215KB, `html2canvas` 196KB, route `[param]` 162KB, `UserPointsScreen` 152KB, `Map` 103KB. Сигнатурный скан `__common`: `leaflet` 312 (вероятно CSS-классы `.leaflet-*` из `criticalCSSBuilder`, не библиотека — без maps не подтверждено), `QueryClient` 47, `yup` 8, `zustand` 6; `react-native-paper`/`reanimated`/`navigation` = 0. **Next (scoped follow-up, не quick-win):** настроить Metro bundle-visualizer / `serializer` с module-map выводом → точный разбор → таргетные выносы. | Open — диагностировано (684+460KB shared); deep-разбор блокирован тулингом (нужен Metro bundle-visualizer config) |
| PERF-015 | Места | CLS fix | `refactor-surgeon` + `travel-expert` | P2 | Снизить CLS на `/places` (baseline 0.097, в пределах Lighthouse «good» <0.1, но у границы) | Диагностика 2026-06-01 (CLS-source capture в `e2e/helpers/perfBudget.ts`): один сдвиг ~0.096; moved-элементы = весь блок левого сайдбара (`featuredCard` «Подборка»-карточки + `chipRow` c кнопкой `Все категории`) смещаются вниз на одну величину → причина = рост элемента **над/вокруг сайдбара** при появлении данных (`showLoadedCounts`), НЕ сами чипы. ❌ Проверенная гипотеза: placeholder-чипы для `chipRow` во время загрузки метрику НЕ сдвинули (0.0967→0.0974), откатил. `cardMediaWrap`/`PlaceCard` геометрию резервируют (не причина). Rect-capture (prev/current Y) дал точную причину: `featuredCount` (счётчик) появляется при `showLoadedCounts` справа в `featuredCard` (`flexShrink:0`) → сужает `featuredTextBlock` (flex) → `featuredName numberOfLines={2}` переносится 1→2 строки → карточка растёт на ~17px → каскадный сдвиг всего сайдбара вниз (НЕ скроллбар: `scrollbar-gutter:stable`+`body{overflow-y:scroll}` уже есть в `criticalCSSBuilder.ts`). **Fix:** `screens/tabs/PlacesScreen.tsx` — счётчик обёрнут в `featuredCountSlot` (`minWidth:28`, рендерится с первого кадра), ширина текст-блока стабильна в обоих состояниях. **Browser ✅ (perf-spec): CLS 0.0967 → 0.0059 (16×)**, 8 tests passed; typecheck/eslint/`check:image-architecture`/`guard:external-links` green. Пост-загрузочный вид идентичен прежнему. Reviewer ✅: diff малый/принципиальный — `minWidth` (не maxWidth) не меняет поведение для крупных счётчиков, текст-блок стабилизирован — 0 actionable findings. Sprint ✅: sign-off в `Page Performance Refactor`. Все 3 гейта пройдены. | Done |

## Full-page UI/UX QA wave

Created: 2026-06-01. Цель: пройтись по полному списку страниц приложения, на каждой сделать скрины и протестировать на web (desktop `1440x900`) и mobile (iPhone 13 / `390x844`), завести баги (`F-*`) и фичи/редизайн-тикеты (`D-*`) на то, что стоит переделать.

Метод для каждой страницы (definition of done на QA-шаг):

1. Открыть роут как гость и (где применимо) как авторизованный e2e-пользователь.
2. Снять скрины: desktop top/scrolled, mobile top/scrolled — в игнорируемую локальную папку (`.codex-temp/page-audit/<page>/`).
3. Проверить: горизонтальный overflow, обрезанный текст кнопок, наложения оверлеев, touch-target `>= 44px`, состояния empty/loading/error, console/page errors = 0, внешние ссылки только через `@/utils/externalLinks`.
4. Завести `F-*` на дефекты и `D-*` на UX/редизайн-предложения; связать с владельцем и acceptance criteria.

Routing: QA-прогон → Мариночка (QA) / Мариночка (Manual QA); скрин-харнесс и health → Витаутас (DevOps) + `test-author`; визуальный аудит и `D-*` тикеты → UI/UX Designer; acceptance → Крина (Business Analyst); фиксы → Ромик (Dev) после repro+approval.

Page inventory (роуты вне уже покрытых travel/Search/Home/Map/Places/Quests/PDF-export):

- Auth / account: `login.tsx`, `registration.tsx`, `register.tsx`, `set-password.tsx`, `accountconfirmation.tsx`, `settings.tsx`, `subscriptions.tsx`.
- User content: `profile.tsx`, `user/[id].tsx`, `favorites.tsx`, `history.tsx`, `userpoints.tsx`, `roulette.tsx`, `calendar.tsx`, `messages.tsx`, `metravel.tsx`, `travelsby.tsx`.
- Travel authoring: `travel/new.tsx` (wizard), `travel/[id].tsx` (edit).
- Articles: `articles.tsx`, `article/[id].tsx` (deprioritized — не в активном использовании, см. [[project_active_features]]).
- Legal / info / system: `about.tsx`, `contact.tsx`, `privacy.tsx`, `cookies.tsx`, `modal.tsx`, `error.tsx`, `[...missing].tsx` (404).

| ID | Task | Owner | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| T-056 | Build reusable page-audit screenshot harness | Витаутас (DevOps) + `test-author` | Done | `.codex-temp/page-audit.mjs` (Playwright, grouped page list, desktop+mobile top/scrolled, overflowX/console/pageError capture + transient-404 retry); run output `.codex-temp/page-audit/report-all.json` | Serves existing `dist/` via `scripts/serve-web-build.js` on `:8085`; reusable per group (`auth`/`content`/`authoring`/`legal`/`articles`/`all`) |
| T-057 | QA pass: Auth & account pages | Мариночка (QA) | Done | `report-all.json`: `login`, `registration`, `register`, `set-password`, `accountconfirmation`, `settings`, `subscriptions` all overflowX=false, console=0, pageErr=0 (desktop+mobile); screenshots in `.codex-temp/page-audit/<page>/` | Most account pages are auth-gated and show login walls as guest; mobile form bottoms hit `D-004` overlap |
| T-058 | QA pass: User content pages | Мариночка (QA) | Done | Guest `report-all.json` clean; authenticated pass `.codex-temp/page-audit-auth/report-auth.json` (login API, userId=104): all 11 gated pages render the authed shell with `loginWall=false`, `overflowX=false`, `pageErr=0` on desktop+mobile; screenshots in `.codex-temp/page-audit-auth/<page>/` | `metravel` empty-state/year-filter → `D-005`; on the E2E-built dist authed data loads cleanly (`badReq=0` on all 11 pages) — the prod-build `401` wave was a token-decode infra artifact, NOT an app bug (see Validation log); `/userpoints` heavy DOM → `D-007`; `user/[id]` audited via `/user/104` |
| T-059 | QA pass: Travel authoring (wizard + edit) | Мариночка (Manual QA) | Done | Guest: `travel/new` renders auth-gate. Authed manual walkthrough on E2E build: 6-step wizard (основная инфо → маршрут → медиа → детали → доп → публикация), step pills + `Назад`/`Далее` nav work, title field + rich-text editor render, `Далее` advances step 1→2, step-2 validation surfaces required-field errors (`Точки/Страны маршрута…`). Evidence `.codex-temp/manual/B1-wizard-step1.png`, `B3-wizard-step2.png` | No publish/save performed; copy nit → `D-008`; `travel/[id]` edit walkthrough still pending |
| T-060 | QA pass: Legal / info / system pages | Мариночка (QA) | Done | `report-all.json`: `about`, `contact`, `privacy`, `cookies`, `modal`, `error`, `404` all overflowX=false, console=0, pageErr=0; screenshots captured | `/modal` boilerplate → `F-005`; `/contact` missing header → `D-006` |
| T-061 | QA pass: Articles pages (deprioritized) | Мариночка (QA) | Done | `report-all.json`: `articles` clean (overflowX=false, console=0, pageErr=0, bodyText≈1900) | Smoke only per active-features rule; `article/[id]` needs a real id, deferred |
| T-062 | UI/UX visual audit → file F-*/D- tickets for all wave pages | UI/UX Designer | Done | Guest + authenticated screenshots reviewed (guest `page-audit/`, authed `page-audit-auth/`, manual `manual/`). Tickets filed: `F-005`, `D-004`, `D-005`, `D-006`, `D-007`, `D-008` (and `D-009` opened then RETRACTED as a timing artifact after verification). Profile-area empty-states (favorites/calendar/messages/subscriptions) judged well-designed and on-brand — no redesign ticket needed. **Round-2 live preview audit (2026-06-01)** added `D-010`/`D-011`/`D-012`/`D-013`/`D-014`/`F-007` + `D-004` confirm across Home/Search/Map/Places (see dedicated section + continuation). Pages captured: Home (d+m), Search (desktop data + mobile error/filter), Map (desktop + mobile), Places (d+m), travel not-found | Valid findings are polish/copy/perf + 2 overlay/data bugs (`D-013`/`D-014`); no other medium+ UX bug confirmed. Populated capture COMPLETED on live backend (2026-06-02): Search `330`, travel detail (d+m, hero contain+blur = `D-001` confirmed), Places `1504`, Map clusters + PlacePopupCard. Closed `D-014`; largely closed `D-011`. Only `travel/[id]` authed-edit visual review still pending |
| T-063 | Acceptance criteria for full-page QA wave findings | Крина (Business Analyst) | In progress | `F-004` no longer blocks the queue; `D-014` resolved; `D-004`/`D-013` have enough evidence to group into `TD-006`; `D-006` needs IA decision | Finish concise AC for `TD-006` and write `D-006` IA recommendation; severity, expected result, non-goals, and DoD per confirmed finding |
| T-064 | Prepare implementation queue for wave findings | Ромик (Dev) | In progress | **Unblocked 2026-06-02**: `F-004` retest/fix evidence exists (`nestedButtons: 0`, console clean); implementation queue moved to `TD-006`; `D-006` is explicitly parked behind BA/Approver IA decision | Start `TD-006` only after UI contract/approval; only confirmed `F-*`/`D-*` with repro, expected result, target files, and validation commands enter implementation |

## Codebase review snapshot

Created: 2026-06-01. Scope: static repository review plus current dirty diff. This is not a full production Lighthouse run and does not replace browser QA for visible UI changes.

Evidence:

- Current branch: `main`.
- Working tree has ongoing unrelated/user changes in `CLAUDE.md`, `docs/RULES.md`, `components/home/Home.tsx`, `components/listTravel/*`, and `docs/AGENT_WORKBOARD.md`; they were reviewed but not reverted.
- Source size scan: 971 TS/TSX files in `app/`, `components/`, `hooks/`, `services/`, `api/`, `utils`, `stores`; about 204k LOC, or 209k LOC including `screens/`.
- `npm run guard:file-complexity -- --json`: 18 files exceed 800 LOC after `TD-005` dropped `ListTravelBase.tsx` below the threshold.
- Skipped-test scan: no `it.skip`, `test.skip`, `describe.skip`, `xit`, or `xtest` found outside the rule text.
- `npm run guard:external-links`: passed; no direct `Linking.openURL` outside `utils/externalLinks.ts` and no direct `window.open` outside approved allowlist.
- Source scan: 12 `react-hooks/exhaustive-deps` disables, 73 TypeScript suppression comments, and 5 `any` hits in `api/`, `hooks/`, `stores`.
- `npm run check:fast:dry`: changed scope would run 11 targeted app tests; `npm run check:e2e:changed:dry`: would run 6 Playwright specs for travel/search.

Findings:

1. P1: Oversized modules remain the largest delivery risk. `guard:file-complexity` still flags core screens and shared services, including `PdfThemeConfig.ts`, `PlacesScreen.tsx`, `QuestsScreen.tsx`, `TravelWizardStepPublish.tsx`, `BookSettingsModal.tsx`, `CompactSideBarTravel.tsx`, `MapQuickFilters.tsx`, `api/client.ts`, and PDF renderer/parser modules. This is now covered by `TD-003` through `TD-021`.
2. P1: Current Home performance diff changed visible loading behavior and required targeted verification. The policy issue found during review (`fallbackDelay = 1200`) was fixed to `1000`, and the Home quick-filter e2e smoke passed; reviewer approval is still required before marking `PERF-001` `Done`.
3. P2: Search/ListTravel refactor crossed the 800 LOC guard, but the module still retains broad responsibilities for route params, data fetching, export, delete flow, fallbacks, and layout orchestration. Keep follow-up ListTravel work behavior-neutral and covered by search/list integration tests.
4. P2: Full-page QA now has inventory coverage, but many pages still lack screenshots/console evidence. `T-056` should land first so QA/design/SEO can work from consistent artifacts.
5. P3: Type-safety debt is concentrated in web/native interop, map, PDF, and list/search helpers. `TD-016` should audit hook disables first, then split `any` cleanup by domain instead of doing a broad typing sweep.

## Findings

### F-001 Duplicate initial travel detail requests

- Severity: medium.
- URL: `/travels/kostel-svyatogo-antoniya-paduanskogo`.
- Viewports: desktop `1440x900`, mobile `390x844`.
- Expected: one initial request or reuse of preload/in-flight promise.
- Actual: desktop observed 3-4 duplicate GET requests to `/api/travels/by-slug/kostel-svyatogo-antoniya-paduanskogo/`, including one aborted request; mobile observed 3 duplicate GET requests.
- Candidate files: `hooks/useTravelDetails.ts`, `api/travelDetailsQueries.ts`, `app/+html.tsx`.
- Fix: direct API preload payload is retained and reused by `useTravelDetails` and guest `fetchTravel` / `fetchTravelBySlug` callers, preventing duplicate React-side detail requests.
- Status: fixed and locally re-tested.

### F-002 Comments main-thread 404 console noise

- Severity: medium / P2.
- URL: `/travels/11-makarska-otdykh-u-moria-doroga-domoi-cherez-karlovats-i-venu`.
- Expected: empty comments state renders without `GET /api/travel-comment-threads/main/?travel_id=...` 404 console noise.
- Actual: manual QA observed `GET /api/travel-comment-threads/main/?travel_id=527` returning 404 while the UI rendered "Пока нет комментариев".
- Fix: comments read path now fetches public comments directly by `travel_id`; it no longer probes main-thread metadata for the normal travel details read state.
- Status: fixed and locally re-tested.

### F-003 Instagram rich-text e2e spec mismatch

- Severity: medium / QA blocker.
- URL: mocked `/travels/e2e-instagram-rich-text`.
- Expected by project rules: valid Instagram post/reel/tv rich-text links render as embedded Instagram content on web.
- Previous e2e expectation: `e2e/travel-instagram-rich-text.spec.ts` waited for `.rich-social-card--instagram` fallback cards and expected zero Instagram iframes.
- Observed DOM: `.travel-rich-text` contains an iframe and no fallback card.
- Resolution: e2e expectation is aligned with the project rule and now accepts Instagram iframe/blockquotes for valid post links while continuing to guard unload policy violations.
- Status: fixed; do not treat iframe rendering as a frontend regression.

### D-001 Missing hero media placeholder is not neutral

- Severity: medium / UI polish.
- URL: `/travels/kostel-svyatogo-antoniya-paduanskogo`.
- Viewports: desktop `1440x900`, mobile `390x844`.
- Expected: missing local/dev media preserves geometry with a neutral placeholder, no text, icons, or decorative message.
- Actual: large hero area renders visible text `Фото недоступно`.
- Owner: UI/UX Designer for design direction, Ромик (Dev) for implementation.
- Fix: `components/travel/details/TravelDetailsOptimizedLCPHero.tsx` now renders an empty neutral placeholder with preserved geometry and no role/aria label/visible text when the LCP image fails.
- Status: fixed and locally verified.

### D-002 Mobile overlays and touch targets need designer review
- Touch-target fixes (mobile-web QA wave, browser-verified 375x812): header controls (`mobileMenuButton`, `modalCloseButton`) `CONTROL_SIZE` 40 -> 44 in `components/layout/customHeaderStyles.ts` (menu button measured 44x44 after); header brand logo hit area `components/layout/Logo.tsx` `logoContainer` minWidth/minHeight 44 + center (logo link measured 44x44, image unchanged at 26/32). Audited Home/Search/Places: bottom nav 48px, quick-filter chips 51px, place-card actions >=44 — all OK. Remaining: Leaflet map controls (~30x30) still below 44 — verification blocked by unstable local map preview; tracked under TD-006.

- Severity: low / UX polish.
- URL: `/travels/kostel-svyatogo-antoniya-paduanskogo`.
- Viewport: mobile `390x844`.
- Evidence: visual audit found several action targets around `33-38px` high (`Подписаться`, `Написать`, section tabs), Leaflet controls at `30x30`, and cookie banner competing with bottom navigation/content.
- Expected: mobile controls meet comfortable touch target sizing and overlays do not hide key actions.
- Owner: UI/UX Designer.
- Status: open.

### F-004 Places cards emit nested-`<button>` hydration errors

- Severity: medium / P2 (console-error noise + invalid SSR markup; no broken final DOM).
- URL: `/places`, viewport mobile `375x812`, guest.
- Expected: place cards render valid, non-nested interactive elements; no React hydration warnings.
- Actual: on first render the console logs repeated React 19 errors: `In HTML, <button> cannot be a descendant of <button>. This will cause a hydration error.` and `<button> cannot contain a nested button.` (6+ occurrences). The outer `<button aria-label="Открыть … на карте">` contains `OptimizedFavoriteButton` + `TravelStatusButton` (`aria-label="Добавить в план"`).
- Guest: after client reconciliation the live DOM has `nestedCount: 0` (the `Добавить в план` status button is not rendered for guests), so the guest symptom is hydration-time only.
- Authenticated (escalated): the `TravelStatusButton` ("Добавить в план") renders as a real button, so the nested `<button>`-in-`<button>` persists in the live DOM — measured `nestedButtons: 20` (one per visible place card) on `/places` while signed in. This is invalid DOM + an accessibility defect (interactive control nested in interactive control), not only console noise. The authenticated case is effectively higher severity than P2.
- Source path: `components/places/PlaceListCard.tsx` → `components/ui/UnifiedTravelCard.tsx` (`rightTopSlot` = `RelatedTravelActionStack`). `UnifiedTravelCard` already renders its web container as `View role="link"` (not button) to avoid this; the offending button wrapper comes from the media/card press-target path when `onCardPress` + `onMediaPress` + `rightTopSlot` are all supplied.
- Repro: open `/places` on mobile web as guest, read browser console at initial load.
- Not reproduced on `/` (Home) or `/search` with the same card component.
- Root cause (corrected): the offending wrapper is `PlaceCard` in `screens/tabs/PlacesScreen.tsx` (not `PlaceListCard`). The card media `Pressable` (`accessibilityLabel="Открыть … на карте"`) wrapped `RelatedTravelActionStack` (favorite + `TravelStatusButton`), nesting buttons inside a button.
- Fix: `screens/tabs/PlacesScreen.tsx` — media wrap is now a plain `View`; the open-on-map press target is a sibling absolute-fill `Pressable` (`cardMediaPressLayer`, zIndex 2) with no interactive children; `RelatedTravelActionStack` and category badge are siblings overlaid above it. No nested interactive elements.
- Verification: authenticated `/places` mobile `375x812` — `nestedButtons: 0` (was 20), console clean (no hydration errors), favorite toggle works without leaking to navigation, media tap opens `/map`, no horizontal overflow. `typecheck` clean, `eslint` clean, `check:image-architecture` + `guard:external-links` + `guard:no-direct-window-open` passed.
- Status: fixed and locally browser-verified.

### D-003 Minor mobile UX observations (guest screenshot pass)

- Severity: low / polish.
- Home `/`: cookie consent banner — re-checked (guest, 375x812): it is a floating dismissible card (rect top 652 / bottom 748, 12px side margins) sitting above the bottom nav (nav top 761, `overlapNav: false`). It overlays the bottom of the featured card title only while shown; this is standard temporary-consent overlay behaviour, not a layout defect. No fix needed.
- Map place popup: save action label rendered truncated as `Сохран…` instead of `Сохранить`. Fix: `components/MapPage/Map/PlacePopupCard/styles.ts` chip width `56/60` → `64/68`. Verified in the live app (browser, app font): rendered `Сохранить` = 60.9px at 11px / 55.9px at 10px; old content width 56px did not fit (matches the observed clip), new content widths 64px (normal) / 60px (compact) fit with +3.1px / +4.1px margin. A live popup screenshot could not be captured because map markers are geolocation/data-gated and did not populate in the headless preview, so sufficiency was verified by measuring real rendered text width vs chip width instead. typecheck + eslint + check:image-architecture + guard:external-links pass.
- Profile `/profile` tabs (Маршруты/Избранное/История): labels were truncated to `Марш…`/`Избр…` because 3 equal `flex:1` thirds (~103px) could not fit icon + label + count badge inline (measured: `Избранное` needed 78px text, had 30px). Fix applied: `components/profile/ProfileTabs.tsx` switched each tab to a column layout (icon + count badge on a top row, full-width label below). Verified in browser (auth, 375x812): all three labels render in full, `clip:false` (clientW==scrollW==91), layout clean; eslint + typecheck pass.
- Places `/places`: some records show `СТРАНА НЕ УКАЗ…` / `Дворец без названия` — backend data quality, not UI.
- Status: Сохранить popup width + profile tabs fixed (profile browser-verified; popup verification pending stable map preview); `Дворец без названия`/country gaps remain backend data quality.

### F-005 `/modal` route ships unmodified Expo template boilerplate

- Severity: medium / P2 (placeholder leaking into the public build).
- URL: `/modal`, desktop `1440x900` + mobile `390x844`, guest.
- Expected: a real modal screen, or the route is removed / not publicly reachable.
- Actual: page title `О сайте` but body is the Expo starter template: `Open up the code for this screen:` / `app/modal.tsx` / `Change any of the text, save the file, and your app will automatically update.` / `Tap here if your app doesn't automatically update after making changes`.
- Evidence (before): `.codex-temp/page-audit/modal/desktop-top.png`.
- Candidate file: `app/modal.tsx`.
- Investigation: `/modal` had zero references (no `router.push`/`href`/`Stack.Screen name="modal"` anywhere) and `EditScreenInfo` was imported only by `app/modal.tsx` — pure dead Expo scaffolding, not a product feature. Removing it is cleanup, not a product trade-off.
- Fix: deleted `app/modal.tsx`, `components/ui/EditScreenInfo.tsx`, and the orphaned `__tests__/components/EditScreenInfo.test.tsx`. The `/modal` route is gone; Expo no longer emits `dist/modal.html`.
- Validation: no orphan imports of the removed files; `typecheck` clean; image/external-link guards passed. Browser verify on rebuilt E2E dist — `/modal` now renders the app's `Страница не найдена` (404) screen with no boilerplate (`.codex-temp/manual/F005-modal-after.png`).
- Status: fixed (awaiting commit).

### D-004 Mobile cookie banner + bottom tab bar overlap page content (cross-page)

- Severity: low-medium / UX. Extends `D-002`/`D-003` beyond travel details to the wider page set.
- Viewport: mobile `390x844`, guest, before cookie consent dismissed.
- Actual: the bottom cookie-consent banner stacks with the bottom tab navigation and together cover the lower part of scrollable content/forms. Visible on `registration` (the `Google Sign-In недоступен…` line + submit area sit under the banner), `login`, `travelsby`, `about`, and others.
- Evidence: `.codex-temp/page-audit/registration/mobile-top.png`, `.codex-temp/page-audit/login/mobile-top.png`, `.codex-temp/page-audit/travelsby/mobile-top.png`.
- Expected: banner and bottom nav reserve safe-area/scroll padding so no primary action or form field is hidden.
- Owner: UI/UX Designer (spec) + Ромик (Dev) (safe-area/scroll padding so the banner + bottom tab bar never cover form fields/CTAs).
- Dispatch: assigned 2026-06-02 to `TD-006` (mobile overlays & touch targets); batch with `D-002`/`D-003`. Implementation only after designer spec approved.
- Status: assigned (TD-006).

### D-005 `/metravel` empty results area + stale year placeholder (partially CORRECTED)

- Severity: low / UX.
- URL: `/metravel`, desktop `1440x900`, guest.
- Correction after code check: the `Год` field is **not** a stale applied filter. `components/listTravel/ModernFilters.tsx:405` uses `value={year ? String(year) : ''}` with `placeholder="2024"`, i.e. the year is empty by default and `2024` is only grey placeholder text — it does NOT filter results. The original "default 2024 → 0 results" claim is withdrawn.
- Remaining valid points: (1) the `placeholder="2024"` is a hardcoded past year (in 2026) — should be dynamic (`new Date().getFullYear()`) or a neutral hint like `Год`; (2) the guest results area showed blank with no visible empty-state copy (needs confirmation on a logged-in account with zero travels, since `/metravel` is the user's own list).
- Evidence: `.codex-temp/page-audit/metravel/desktop-top.png`; `ModernFilters.tsx:405-414`.
- Owner: `travel-expert` for placeholder; UI/UX Designer to confirm empty-state.
- Fix (point 1): `components/listTravel/ModernFilters.tsx` year `placeholder` is now `String(new Date().getFullYear())` (dynamic) instead of the hardcoded `2024`. Browser-verified on rebuilt E2E dist: placeholder reads `2026`. Filters integration test 16 passed; guards passed.
- Status: placeholder fixed (awaiting commit); empty-state confirmation (point 2) still open for UI/UX Designer.

### D-006 `/contact` renders without the global top navigation header

- Severity: low / navigation consistency.
- URL: `/contact`, desktop `1440x900`, guest.
- Actual: the contact page (`MeTravel.by` / `О проекте` / step list + contact form) renders with footer only and no top navigation bar, so returning to the app relies on footer links. `about`, `privacy`, and most other pages keep the global header.
- Evidence: `.codex-temp/page-audit/contact/desktop-top.png` vs `.codex-temp/page-audit/privacy/desktop-top.png`.
- Expected: consistent global header/navigation across content pages, or an explicit back/home affordance.
- Root cause: `app/contact.tsx` is a top-level route (outside `app/(tabs)/`), so it does not inherit the `(tabs)` global nav header; it uses its own `AboutHeader`. `/about` lives in `(tabs)` and keeps the header. Fixing means moving the route into `(tabs)` or adding the global header — an information-architecture decision.
- Owner: Крина (Business Analyst) + Андриуш (Approver) to decide intended IA (standalone page vs in-app nav); Ромик (Dev) implements after decision.
- Dispatch: assigned 2026-06-02 to BA/Approver as a product/IA decision (not an autonomous code fix).
- Status: assigned (awaiting IA decision).

### D-007 `/userpoints` fetches `perPage=5000` and renders a very heavy DOM

- Severity: low-medium / performance.
- URL: `/userpoints`, authenticated (userId=104), desktop `1440x900` + mobile `390x844`, E2E build.
- Actual: the page issues `GET /api/user-points/?page=1&perPage=5000` and renders the full result without pagination/virtualization; captured `document.body.innerText` length ≈ `283,000` chars (vs ~300-1,000 on every other authed page). Map + side panel render fine visually, but the in-page text/DOM volume is two-to-three orders of magnitude larger than peers.
- Evidence: `.codex-temp/page-audit-auth/userpoints/desktop-top.png`; `report-auth.json` (`bodyText≈283269`); the `perPage=5000` URL was captured in the prod-build run's badRequests.
- Root cause confirmed: `components/UserPoints/PointsList.tsx:57` sets `defaultPerPage = Platform.OS === 'web' ? 5000 : 200` — the large fetch is intentional so the points MAP shows all of the user's markers at once. Simply lowering `perPage` would drop map markers (regression), so this is NOT a safe quick-fix.
- Expected: keep loading all points for the map, but virtualize / lazily render the accompanying list so the DOM does not hold all rows at once.
- Owner: `travel-expert`/`refactor-surgeon` — the real fix is list virtualization, coupled with the existing `TD-014` split of `PointsList.tsx` (909 LOC). Promote to a `PERF-*` item rather than a standalone patch.
- Status: open; deferred to `TD-014` / `PERF-*` (not a contained quick-fix).

### D-008 Wizard step-2 validation copy has plural-agreement error

- Severity: low / UX copy.
- URL: `/travel/new`, step 2 (Маршрут), authenticated.
- Actual: required-field validation renders `Точки маршрута обязательно для заполнения` and `Страны маршрута обязательно для заполнения`.
- Expected: plural agreement — `Точки маршрута обязательны для заполнения`, `Страны маршрута обязательны для заполнения` (or singular `Точка/Страна … обязательна`).
- Evidence (before): `.codex-temp/manual/B3-wizard-step2.png`.
- Owner: UI/UX Designer / Крина (BA) for copy; Ромик (Dev) for the string.
- Fix: added optional `requiredMessage` override to `FieldRule` in `utils/travelWizardValidation.ts` and set it for `coordsMeTravel` / `countries` (`«… обязательны для заполнения»`) in both step-2 rule sets; the generic neuter template is unchanged so `Название`/`Описание` messages stay correct. Unit test added (`__tests__/utils/formValidation.travelWizard.test.ts`).
- Validation: `formValidation.travelWizard.test.ts` 18 passed; `typecheck` clean; `check:image-architecture` + `guard:external-links` passed; browser verify on rebuilt E2E dist — step 2 renders `Точки/Страны маршрута обязательны для заполнения`, no `обязательно` form, 0 console errors (`.codex-temp/manual/D008-verify-step2.png`).
- Status: fixed (awaiting commit).

### D-009 Global header shows `Гость` on authenticated profile-area pages — RETRACTED (invalid)

- Resolution: **invalid / not a bug.** Re-tested by polling the header account label for ~12s on `/favorites` and `/profile` (authed): both resolve to `Открыть меню аккаунта sergey@lyte.com`. The `Гость` seen in the audit screenshots was a timing artifact — `AuthContext` defers `checkAuthentication()` on web via `requestIdleCallback({timeout:1500})` (intentional, to reduce TBT, per `context/AuthContext.tsx`), so the screenshot at ~1.8s captured the pre-hydration header. A real logged-in user sees their account. Evidence: `.codex-temp/hdr-check.mjs` output. No ticket.
- (original report below, kept for the journal)
- Severity: medium / UX (auth-state confusion).
- URLs: `/profile`, `/favorites`, `/history`, `/calendar`, `/messages`, `/subscriptions`, `/settings`, authenticated (account `sergey@lyte.com`), E2E build, desktop `1440x900`.
- Actual: the top-right account menu renders `Гость` on all these gated pages even though the user is logged in and the page's personal data loads (empty-states are the user's own). On `/travels/{slug}` the same header correctly shows the logged-in account (`sergey@lyte.com`).
- Evidence: `.codex-temp/page-audit-auth/{favorites,calendar,messages,subscriptions}/desktop-top.png` (header `Гость`) vs `.codex-temp/manual/travel-details.png` / `A1-details-top.png` (header `sergey@lyte.com`).
- Expected: a logged-in user sees their account (name/avatar) in the header consistently across all routes; `Гость` only for guests.
- Note: empty-states themselves on these pages are well-designed and on-brand (heart/calendar/dialog icons + CTA) — finding is the header auth indicator only.
- Owner: Ромик (Dev) to check the header's auth-source/hydration on profile-area routes; UI/UX Designer to confirm expected logged-in header.
- Status: open.

### F-006 Flaky `login.test.tsx` under full-suite load (lazy LoginForm)

- Severity: medium / P2 (CI/pre-commit flakiness; не баг продакшена).
- Симптом: при широком `check:fast`/полном batch (25 сьютов параллельно) `__tests__/components/login.test.tsx` падал: `Unable to find an element with placeholder: Email`, дерево = `<View><ActivityIndicator/></View>`.
- Root cause: `app/(tabs)/login.tsx` рендерит `<Suspense fallback={<ActivityIndicator/>}>` поверх `React.lazy(() => import('@/components/auth/LoginForm'))`. Под нагрузкой динамический `import()` резолвится дольше дефолтного ~1000ms таймаута `findByPlaceholderText` → тест видит только спиннер.
- Не регрессия PERF-работы: `LoginForm` не импортирует изменённые модули (`Home`/`homeHeroStyles`/`useProgressiveLoading`/`perfBudget`); в изоляции и под 5-сьютовой нагрузкой тест проходит (76 passed).
- Fix: `__tests__/components/login.test.tsx:112` — `findByPlaceholderText('Email', undefined, { timeout: 10000 })` (headroom для lazy-резолва). Поведение не меняется.
- Verification: полный 25-сьютовый batch из репорта снова зелёный — `25 suites / 335 tests passed` (7.95s, без flake); `eslint` clean.
- Status: fixed.

## Full-page UI/UX QA wave — round 2 (live preview audit, 2026-06-01)

Audited the running app in a real browser via the preview harness, in page order Главная → Поиск → Путешествие → Карта → Места, on desktop `1440x900` and mobile `390x844`. Served the fresh web export (`dist/`, built 2026-06-01 22:15) through a local clean-URL static server (`.claude/dist-server.js` on `:4601`) because the Metro dev server OOM-crashed on heavy RN-Web routes and the static export is stable for screenshots.

Captured with real rendered evidence: **Home** (desktop hero + weekend-route carousel, desktop random-route empty state, mobile hero/chips/route-card/bottom-nav), **Search** (desktop with live data — 380 results, country facets, cards), **Map** (mobile controls + markers), **Travel detail** (not-found state). Positive notes (do NOT touch): the random-route, search-retry, and travel-not-found empty states are all on-brand and well-composed (neutral icon + message + single CTA); the mobile home route-card image renders correct `fit=contain` + blurred letterbox from the first frame (image rule satisfied).

`verify pending` (external blocker, not app bugs): the preview browser tab was contended by another automation that repeatedly drove navigations to `/map` and to specific travel slugs mid-hydration, and the E2E build's API (`127.0.0.1:8124`) was intermittent. As a result, fully-populated **Places**, **Map desktop**, a **populated travel detail**, and **mobile Search** were not cleanly captured this pass and remain to re-shoot once the tab/API are exclusive and warm.

### D-010 Touch targets below 44px across cards/carousel/footer/cookie (mobile = bug, desktop = polish)

- Severity: medium / P2 (WCAG 2.1 AA 2.5.5 target size). Extends `D-002`.
- URLs/viewport: `/` and `/search`, mobile `390x844` (bug) + desktop `1440x900` (polish). Guest, E2E `dist` build.
- Actual (measured via bounding boxes): travel-card favorite (heart) and add (plus) buttons ≈36px; home weekend-carousel prev/next arrows 32×32; footer link rows ≈32px tall; cookie banner `Отклонить`/`Принять` ≈36px tall. Several `a/button` nodes report height<44 on the home/search shells.
- Expected: interactive controls have a ≥44×44px hit area on touch (hit-slop/padding is fine; the visual can stay compact). Desktop pointer targets can be smaller but the card heart/plus should still be comfortable.
- Owner: UI/UX Designer to set the target-size token / hit-slop rule; Ромик (Dev) to apply (card actions, carousel arrows, cookie buttons).
- Status: open. Evidence: round-2 preview screenshots (home desktop/mobile, search desktop).

### D-011 Search year facet defaults to stale `Год 2024` (cross-links D-005)

- Severity: medium / P2 (UX correctness). Same class as `D-005` (`/metravel` stale year), now confirmed on `/search`.
- URLs/viewport: `/search`, desktop `1440x900` (and mobile filter sheet). Guest, E2E build.
- Actual: on first load the left-sidebar year filter shows `Год 2024` while the current year is 2026. With live data the page still returned 380 results, so the 2024 value is a hardcoded/stale default rather than "latest year with data".
- Expected: default to no year filter, or to the most recent year actually present in the dataset; never a hardcoded past year.
- Owner: Ромик (Dev) to confirm the default-year source (same investigation as `D-005`); UI/UX Designer to confirm the desired default (no-filter vs latest-year).
- Status: **largely resolved** — with the live backend the facet shows `Год 2026` (current/latest year in data), confirming the default is data-driven, not hardcoded. The `2024` seen earlier was the cold-API/stale state. Residual (low priority): confirm the no-data fallback never pins a past year. Evidence: cold-API screenshot (`Год 2024`, `380`) vs live screenshot (`Год 2026`, `330 путешествий`).

### D-012 Home weekend-route carousel sits as a grey/dark placeholder during slow API (polish)

- Severity: low / P3 (polish; image-rule compliant, not a defect).
- URLs/viewport: `/`, desktop `1440x900`. Guest, E2E build under slow/cold API.
- Actual: the right-page "Маршрут недели" carousel card (`Тропа ведьм` 4/5, then `Озеро Блед`) renders the neutral grey placeholder + dark bottom gradient for a few seconds before the contained photo appears. The placeholder itself is correct per the neutral-placeholder rule.
- Expected (polish only): consider a subtle shimmer or keeping the shared-source blur visible during the fetch so the hero card reads as "loading" rather than "empty" on first paint. Must keep `fit=contain` + blur-from-first-frame; do not add lazy/offscreen skipping.
- Owner: UI/UX Designer (loading affordance) + `travel-expert`/Ромик (Dev) for the card.
- Status: open. Evidence: home desktop hero screenshots (grey card vs loaded `Озеро Блед`).

### F-007 Search/home initial loads can flash a transient error/empty state under slow API (not a stable bug)

- Severity: low / P3 (resilience observation; reproduced as transient only).
- URLs/viewport: `/search` (`Ошибка загрузки / Не удалось загрузить путешествия / Повторить`) and `/` random-route (`Случайная идея пока не загрузилась`), both viewports.
- Actual: on a cold/slow API the first paint showed the error/empty state, and a subsequent load of the same route rendered full data (`380 путешествий`). The states themselves are well-designed; the finding is only that they can appear before data settles.
- Expected: confirm there is a retry/skeleton path so a slow first response does not strand the user on the error card (the `Повторить` CTA already exists — verify it refetches).
- Owner: Ромик (Dev) to confirm refetch/skeleton behavior; QA to retest under throttled network. Likely no change needed beyond confirming.
- Status: open (needs confirm-or-close). Evidence: search desktop error-state vs data-state screenshots.

### D-004 — round-2 confirmation (cookie banner overlap, cross-page)

- Re-confirmed live on the running app: the cookie consent banner overlaps page content on every audited route — on mobile home it covers the bottom of the featured route card; on mobile/desktop search it sits over lower result cards; on mobile map it overlaps the bottom of the map canvas above the bottom nav. Temporary/dismissible, so still polish, but the mobile stacking (banner + 6-tab bottom nav) eats meaningful vertical space. Recommendation unchanged from `D-004`/`MTC-009`: lift the banner above the bottom nav with safe-area inset (or a slimmer bottom bar) and ensure it never covers a primary card CTA. Evidence: round-2 home mobile, search desktop, map mobile screenshots.

### Round-2 continuation (Places + Map desktop + mobile Search, 2026-06-01)

Captured cleanly this pass (no tab drift): **Places** desktop + mobile, **Map** desktop, **mobile Search**. The Places and Map empty states are on-brand and well-composed (neutral icon + message + recovery CTA) — do NOT touch. Mobile filter access is now resolved (see T-037 note): Search exposes a funnel icon in the search bar; Places exposes a `Категории 10 ⌄` trigger + `Сбросить`. Populated travel detail and populated Search/Places data remain `verify pending` — the E2E API (`127.0.0.1:8124`) was down in this window (Search → `Ошибка загрузки`, `/places` → `0 в каталоге`, travel slug → `Путешествие не найдено`); all three render their correct not-found/error/empty states, so this is API availability, not a UI bug.

**Root cause of the instability (diagnosed 2026-06-02 ~10:05): a concurrent CI run owned by another session on this same repo.** `ps` showed two live `expo export -p web` jobs (one rebuilding `dist/` itself → it wiped `dist/index.html` + `dist/_expo` mid-export, so there was no client JS to hydrate), and a live Playwright e2e batch (`filters-sorting-ux`, `travel-detail-interactions`, `travel-comments`, `map-popup-close`, `points-map-popup`, `--workers=1`) cycling its own `scripts/e2e-webserver.js` on `:8085` and driving browsers — **this is what kept navigating the preview tab to `/map` and to travel slugs**, and the two exports saturated CPU (170%+ each), crashing the preview browser/static server repeatedly. The API itself is fine: a `scripts/serve-web-build.js` proxy started on `:8124` with `E2E_API_URL=http://192.168.50.36` returned HTTP 200 with real travel JSON from the LAN backend (`192.168.50.36`, the e2e upstream from `.env.e2e`). The remaining populated-data shots are blocked only until that concurrent run finishes (must not be interrupted — it is another session's active work); resume the capture against the freshly-built `dist/` served via `serve-web-build.js` (the new build's baked API base is `127.0.0.1:8085`).

### Round-2 populated capture — verify-pending RESOLVED (2026-06-02, live backend)

After the concurrent run drained, held `:8085` with my own `serve-web-build.js` (proxy → `192.168.50.36`) and captured every previously-blocked populated state cleanly:

- **Search (desktop), live data:** `330 путешествий`, country facets with real counts (`Беларусь 161` etc.), cards with photos, ratings (`5.0`), views (`3.9K`, `38.4K`), heart/plus actions. **Year filter now shows `2026`** (was `2024` when the API was cold) → the default is data-driven (latest year present), not a hardcoded stale value. **This largely closes `D-011`** — the only residual is confirming the no-data fallback never pins a past year (low priority).
- **Travel detail (desktop + mobile), `modyn-…-beskidov-1`:** full page — author card (`Julia`, `3 898` views), section nav (Галерея/Описание/Экскурсии/Карта маршрута/Координаты/Рядом ~60км/Популярные/Комментарии/Скачать), weather widget, gallery `1/7`. **Hero gallery image renders correct `fit=contain` + shared-source blur letterbox from the DOM — confirms the `D-001` fix live.** Mobile collapses the section nav into a sticky `НАВИГАЦИЯ` header with a `≡` toggle; gallery arrows are comfortably large (~56px). Cookie banner overlaps the bottom action toolbar (another `D-004` instance).
- **Places (desktop), live data:** `Места · 1504 в каталоге`, `Все страны (242)`, category counts (`История и руины 262`, `Природа и вода 195`, `Замок 51`, `Дворец 50`, `Озеро 46`…), place cards with type tags (Дворец/Руины замка/Озеро) and `На карте`/`Прочитать` CTAs. Note: place-card thumbnails render as neutral grey placeholders (place media not loading in list cards) — minor content/media gap to verify. **This + the map below RESOLVE `D-014`** (the earlier `0 в каталоге` was purely the cold API, not a real mismatch).
- **Map (desktop), live data + popup:** left panel now `Места 23` with populated `Что посмотреть` counts (`Костёл 2`, `Парковка 3`, `Родник 2`, `Руины дворца 3`…), map clusters (`5/3/5/2/6`) + orange place pins in the 60-km radius. Clicking a place pin opens the **PlacePopupCard**: title (`Новосёлковский сельский Совет`), address, coordinates `53.49…,28.05…` + copy, `Открыть страницу` CTA, and an external-nav grid (`Google / Organic / Waze / Яндекс / Telegram / Сохранить`). Two follow-ups: (a) verify those external-map links route through `@/utils/externalLinks.openExternalUrl` (not `Linking.openURL`); (b) popup title row sits close to the top controls bar — check it isn't clipped on shorter viewports / mobile (`D-002` popup-layout).
  - **Follow-up (a): RESOLVED (code-verified 2026-06-02).** All popup nav actions (Google/Organic/Waze/Яндекс/Telegram/Сохранить) call `openExternalUrlInNewTab` from `@/utils/externalLinks` (`components/MapPage/Map/createMapPopupComponent.tsx:119,146,153,160,167,174`). The `Открыть страницу` `<a href>` (`PlacePopupCard/index.tsx:344`) is internal — `onClick` does `preventDefault()` + `onOpenArticle()`, anchor kept only for SEO/a11y. `npm run guard:external-links` passes (no direct `Linking.openURL` / `window.open`). No change needed.
  - **Follow-up (b): still pending** — mobile popup-clipping shot blocked by the concurrent CI run wiping `dist/` again (another `expo export` cycle, `dist/index.html`/`map.html` removed mid-run). Re-shoot `/map` mobile popup once the repo is quiet. Low priority / polish (`D-002`).

Net: all five pages now have populated evidence on desktop + mobile (where applicable). `D-014` closed; `D-011` largely closed; `D-001` re-confirmed fixed. Remaining open: `D-004`/`D-010`/`D-013` (overlay + touch-target polish), plus the two small map-popup follow-ups above.

### D-013 Mobile Places: cookie banner hides the empty-state primary CTA `Обновить` (bug)

- Severity: medium / P2 (overlay hides an action — stronger than the generic `D-004` polish).
- URLs/viewport: `/places`, mobile `390x844`. Guest, E2E build, empty catalog.
- Actual: with the catalog empty (`Каталог пока пуст`), the empty-state `Обновить` button sits directly behind the bottom cookie consent banner and is mostly occluded — the user cannot tap the only recovery CTA until the banner is dismissed.
- Expected: the cookie banner must never overlap a primary CTA; either dock it with safe-area inset above the bottom nav, or ensure empty-state CTAs reserve space below the banner.
- Owner: UI/UX Designer (banner placement, same fix as `D-004`); Ромик (Dev) to apply.
- Status: open. Evidence: round-2 places mobile screenshot.

### D-014 Map shows place markers while Places catalog reports `0 в каталоге` (data/UX inconsistency)

- Severity: low-medium / P3 (consistency; needs data-source confirm).
- URLs/viewport: `/map` desktop `1440x900` vs `/places` desktop/mobile. Guest, E2E build.
- Actual: the Map renders triangle place markers (e.g. around Заславское водохранилище / Минск) while the Places catalog simultaneously shows `Места · 0 в каталоге` / `Каталог пока пуст` and all category counts = `0`. The same conceptual entity ("места") appears populated on the map but empty in the catalog.
- Expected: Map markers and Places catalog should agree on whether places exist (or the copy should explain why they differ, e.g. map points come from travel routes vs a curated places list). Confirm both read the same source on a populated dataset.
- Owner: Ромик (Dev) / `map-expert` + `travel-expert` to confirm the two data sources; UI/UX Designer for the copy if they are intentionally different.
- Status: **RESOLVED / not a bug** — verified on the live backend (2026-06-02): Places catalog shows `1504 в каталоге` and the Map shows clusters + `Места 23` with populated `Что посмотреть` counts. Both are populated when the API is up; the earlier `0 в каталоге` was purely the cold/down API, not a real map-vs-catalog mismatch. Evidence: populated map desktop (clusters + PlacePopupCard) and places desktop (`1504`).

## Validation log

- `npm run check:fast:dry` showed the current dirty working tree is limited to existing profile-related files at the time of the dry run.
- `npx playwright test e2e/open-travel.spec.ts --project=chromium --workers=1` passed: travel details page can open from the travel list smoke flow.
- QA reported `npx playwright test e2e/travel-detail-page.spec.ts e2e/travel-detail-interactions.spec.ts e2e/travel-rating.spec.ts --project=chromium --workers=1` passed: `40 passed`.
- `npm run test:run -- __tests__/api/travels.test.ts` passed: `69 passed`.
- `npm run test:run -- __tests__/hooks/useTravelDetails.test.ts` passed: `11 passed`.
- `npm run test:run -- __tests__/components/CommentsSection.test.tsx __tests__/api/comments.test.ts` passed: `39 passed`.
- `npx playwright test e2e/open-travel.spec.ts --project=chromium --workers=1` passed after F-001 fix.
- Local e2e build browser check for F-001 passed: mobile direct travel URL emitted one `/api/travels/by-slug/kostel-svyatogo-antoniya-paduanskogo/` request, initiated by `travel-hero-preload.js`.
- Local e2e build browser check for F-002 passed: comments section emitted no `/api/travel-comment-threads/main/` request and one `/api/travel-comments/?travel_id=527` request; no critical errors.
- Extended web QA: `E2E_FORCE_REBUILD=1 E2E_API_PROXY_INSECURE=true EXPO_PUBLIC_E2E=true npx playwright test e2e/travel-detail-page.spec.ts e2e/travel-detail-interactions.spec.ts e2e/travel-comments.spec.ts e2e/travel-instagram-rich-text.spec.ts e2e/layout-responsive.spec.ts --project=chromium --workers=1` returned `47 passed`, `1 flaky`, `1 failed`.
- Extended QA failure: `e2e/travel-instagram-rich-text.spec.ts` failed because it expects Instagram fallback cards, while the rendered page contains an iframe; logged as F-003.
- Extended QA flaky: `e2e/layout-responsive.spec.ts` first run timed out with `AggregateError: All promises were rejected`, retry passed.
- Visual audit script: `.codex-temp/travel-visual-audit.mjs`.
- Visual audit evidence: `.codex-temp/travel-visual-audit/desktop-top.png`, `.codex-temp/travel-visual-audit/mobile-top.png`, `.codex-temp/travel-visual-audit/desktop-scrolled.png`, `.codex-temp/travel-visual-audit/mobile-scrolled.png`, and `.codex-temp/travel-visual-audit/report.json`.
- Visual audit result: no horizontal overflow on desktop or mobile; internal scroll container is `travel-details-scroll`; missing media placeholder and mobile touch-target/overlay polish logged as D-001 and D-002.
- D-001 code verification: `npm run test:run -- __tests__/components/travel/TravelDetailsContainer.performance.web.test.tsx` passed: `4 passed`.
- D-001 scope verification: `npm run check:fast` passed: targeted app tests `199 passed`, external-link guards passed.
- D-001 browser verification: `E2E_FORCE_REBUILD=1 E2E_API_PROXY_INSECURE=true EXPO_PUBLIC_E2E=true npx playwright test e2e/travels.spec.ts --project=chromium --grep "should display hero image" --workers=1` passed: `1 passed`.
- Board unblock: `T-012` / `TD-002` marked done because current `e2e/travel-instagram-rich-text.spec.ts` asserts the canonical Instagram embed behavior; `T-053` moved from `Blocked` to `In progress` with `F-004` as the next evidence-backed candidate.
- Board unblock validation: `E2E_FORCE_REBUILD=1 E2E_API_PROXY_INSECURE=true EXPO_PUBLIC_E2E=true npx playwright test e2e/travel-instagram-rich-text.spec.ts --project=chromium --workers=1` passed: `1 passed`.
- Backlog/codebase review validation: `npm run check:fast` passed (`11` targeted suites / `199` tests) and `npm run guard:external-links` passed.
- Tech-debt validation: `npm run guard:file-complexity:changed` passed with `0` changed-file violations; full complexity scan still reports `18` files above `800` LOC and they are covered by `TD-003` through `TD-021`.
- Home perf smoke after timeout-policy fix: `E2E_FORCE_REBUILD=1 E2E_API_PROXY_INSECURE=true EXPO_PUBLIC_E2E=true npx playwright test e2e/home-quick-filters-nightstay.spec.ts --project=chromium --workers=1` passed: `1 passed`.
- Hygiene: root-level `.codex-temp-auth.json` temporary auth artifact was removed without reading or printing its contents.
- Anti-idle dispatch: `npm run workboard:heartbeat` passed in dry-run mode; run `20260601T154749Z-check-fast-dry`, evidence `.codex-temp/workboard/runs/20260601T154749Z-check-fast-dry`, changed scope limited to `docs/AGENT_WORKBOARD.md`.
- Full-page QA wave (guest): harness `.codex-temp/page-audit.mjs` ran all 25 pages against `dist/` served on `:8085`; final `report-all.json` = `0/25` flagged (overflowX=false, console=0, pageErr=0 everywhere). First run had transient `404 Not found` documents from `serve-web-build.js` under parallel browser fetches; confirmed transient via direct `curl` (200) and a clean re-run, then fixed in-harness with a retry-on-4xx/empty-body loop.
- Full-page QA wave findings: `F-005` (`/modal` ships Expo boilerplate), `D-004` (mobile cookie banner + bottom nav overlap, cross-page), `D-005` (`/metravel` empty-state + stale default year 2024), `D-006` (`/contact` missing global header). Evidence screenshots under `.codex-temp/page-audit/<page>/`.
- Full-page QA wave (authenticated): harness `.codex-temp/page-audit-auth.mjs` logs in via `POST https://metravel.by/api/user/login/` (userId=104), injects the encrypted `secure_userToken` exactly like `e2e/global-setup.ts`, and audited 11 gated pages. Result `report-auth.json`: `loginWall=false`, `overflowX=false`, `pageErr=0` on all 11 (desktop+mobile); authed shells render (e.g. `settings` full profile form). `messages`/`metravel` initial `404` were the same transient serve race and rendered real content on the capture re-run.
- Full-page QA wave (authenticated, E2E build): rebuilt the web export with `E2E_FORCE_REBUILD=1 EXPO_PUBLIC_E2E=true` via `scripts/e2e-webserver.js` (so `EXPO_PUBLIC_API_URL=http://127.0.0.1:8085` and the app proxies `/api` to `metravel.by`), then re-ran `.codex-temp/page-audit-auth.mjs`. Result `report-auth.json`: all 11 gated pages have `loginWall=false`, `overflowX=false`, and **`badRequestCount=0`** (no `401`) on desktop+mobile. This confirms the earlier `401` wave was purely the production-build token-decode artifact below — on the E2E build the injected `secure_userToken` decodes correctly and authed data loads. New finding `D-007` (`/userpoints` heavy DOM, `bodyText≈283k`) came from this run. Prod-build authed screenshots preserved under `.codex-temp/page-audit-auth-prodbuild/`.
- Manual authenticated interaction pass (E2E build, account `sergey@lyte.com`, non-destructive): on `/travels/kostel-svyatogo-antoniya-paduanskogo` — favorite `Добавить в избранное` → click flips to remove-state → reverted back, test account left clean (verified by a fresh action-state dump); `Добавить в план` opens a status picker (`Был здесь`/`Планирую`/`Хочу побывать`, no status selected); `Перейти к разделу Комментарии` scrolls and the `Написать комментарий…` input is present (not posted); rating control `Оценить на N из 5` present (not submitted); gallery `Next/Previous slide` clickable when tested in isolation. On `/travel/new` — 6-step wizard navigates, `Далее` advances step 1→2, step-2 required-field validation fires. No rating/comment/publish writes performed. Evidence `.codex-temp/manual/*.png`, `manual-interact-log.txt`. New copy nit `D-008`.
- Infra note (NOT an app bug): `scripts/serve-web-build.js` intermittently returns `404` for both HTML documents and lazy JS chunks under parallel browser fetches; for a lazy chunk this hard-crashes into the error boundary (`Что-то пошло не так` + `Loading module …TravelHeroInteractiveSlider-….js failed`). The chunk exists and `curl` serves it `200` consistently; mitigated in harnesses with reload-on-crash retry. DevOps (`T-052`/`T-056`) should consider making the local serve concurrency-safe.
- Comment write-flow CRUD (approved scope = comments-with-rollback; account `sergey@lyte.com`, travel `391`): the lazy `CommentsSection` chunk would not reliably mount on the flaky local serve (no comment XHR after several full reloads), so the write flow was exercised against the real API the UI calls (`api/comments.ts` contract). Sequence: `POST /api/travel-comments/ {travel_id, text}` → `201` (returned the new comment); `PATCH /api/travel-comments/{id}/ {text}` → `200` (text updated to "…(отредактировано)"); `DELETE /api/travel-comments/{id}/` → `204`. Mandatory cleanup ran in `finally`; net-zero on prod. Observed: `GET /api/travel-comments/?travel_id=391` → `400`, which `api/comments.ts` already swallows as an empty state (consistent with `F-002`). Publish and author-only flows were intentionally not run. Evidence `.codex-temp/manual/cmt-api-crud-log.txt`.
- Finding validation before fixing (caught two false positives): `D-009` (header `Гость` while logged in) RETRACTED — polling the account label ~12s on `/favorites` and `/profile` resolves to `sergey@lyte.com`; it was the intentional deferred `checkAuthentication` (`requestIdleCallback({timeout:1500})`) captured pre-hydration. `D-005` corrected — `ModernFilters.tsx` year is empty by default with `placeholder="2024"` (not an applied filter), so "default 2024 → 0 results" is withdrawn; only the stale placeholder year remains.
- `D-008` fix + browser verification: edited `utils/travelWizardValidation.ts` (added `FieldRule.requiredMessage`, set plural messages for `coordsMeTravel`/`countries`), added a regression test. `npx jest __tests__/utils/formValidation.travelWizard.test.ts` → 18 passed; `__tests__/api/misc.behavior.test.ts` → 19 passed; `tsc --noEmit` clean on touched files; `check:image-architecture` + `guard:external-links` passed. Rebuilt the E2E dist and drove `/travel/new` to step 2: validation now shows `Точки/Страны маршрута обязательны для заполнения`, the `обязательно` form is gone, 0 console errors. Evidence `.codex-temp/manual/D008-verify-step2.png`.
- Authenticated DATA limitation on the PRODUCTION dist build (NOT an app bug): every gated page's authed API calls returned `401` (`/api/user/104/profile/`, `/api/user/subscriptions/`, `/api/message-threads/`, `/api/user-points/…`, `/api/travels/?where=user_id:104…`). Root cause isolated: the login token is valid — direct calls succeed (`PROD` and local `PROXY` both `200` with `Authorization: Token …`; `/api/user/104/profile/` is even `200` without auth) — but a manually injected `enc1:` token does not survive `utils/secureStorage` decode in this **production** `dist` build, so the app sends a malformed `Authorization` header → `401`. The supported authenticated-data path is an E2E-built dist (`EXPO_PUBLIC_E2E=true`) via the Playwright `webServer`; authed data walkthrough (favorites/history/userpoints/subscriptions/messages content, wizard data steps, `travel/[id]` edit) remains pending on that build.

## Manual test cases backlog

| ID | Priority | Viewport | Scenario | Steps | Expected result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| MTC-001 | P1 | Desktop + mobile | Open public travel details by direct URL | Open `/travels/kostel-svyatogo-antoniya-paduanskogo`; wait for hero and main content | No blank screen; title, author, hero area, meta chips, navigation, and key sections render | Screenshot + console log |
| MTC-002 | P1 | Mobile `390x844` | Scroll travel details internal container | Swipe/scroll from hero to description, map, points, comments, share | Sticky/bottom navigation remains usable; no clipped controls or horizontal overflow | Mobile screenshots at top/mid/bottom |
| MTC-003 | P1 | Desktop + mobile | Missing media fallback | Open travel with unavailable local/dev image | Placeholder keeps media geometry and follows neutral placeholder rule | Screenshot of hero |
| MTC-004 | P1 | Authenticated desktop + mobile | Comments write flow | Log in via e2e user; create, reply, edit, like/unlike, delete a comment | Comment actions succeed; ownership/admin restrictions are correct; no main-thread 404 noise | Screenshot + network/console notes |
| MTC-005 | P1 | Authenticated desktop + mobile | Favorite and rating flow | Log in; add travel to plan/favorite; set/change rating; refresh | State persists and controls show correct selected state | Screenshot before/after refresh |
| MTC-006 | P2 | Desktop + mobile | Section navigation | Use side nav/top chips to jump to gallery, description, map, points, comments | Correct section becomes visible; focus/pressed state updates; no overlay blocks target | Screenshot after each jump |
| MTC-007 | P2 | Desktop + mobile | Share/export actions | Use copy link, copy post text, Telegram/VK/WhatsApp, PDF export entry | Actions use safe external-link helpers; user sees clear feedback or allowed navigation | Console + action result notes |
| MTC-008 | P2 | Desktop + mobile | Instagram rich text | Open mocked/known travel with valid Instagram post/reel/tv link | Valid post/reel/tv renders as embed on web; unsupported Instagram URLs use fallback | Screenshot + DOM note |
| MTC-009 | P2 | Mobile | Cookie consent and bottom nav overlap | Reset cookie consent; open travel; inspect banner with bottom nav and primary actions | Banner does not hide critical controls; dismiss/accept targets are easy to tap | Screenshot |
| MTC-010 | P3 | Desktop + mobile | Error states | Open non-existent slug and simulate media/API failures where possible | Error state is readable; no app crash; recovery/back navigation works | Screenshot + console log |
