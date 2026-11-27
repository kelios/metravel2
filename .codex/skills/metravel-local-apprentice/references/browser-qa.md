# Local browser QA under teacher review

Use only for browser-QA assignments. The normal development ACP profile is
separate. Follow `metravel-qa-agent` and operation locks. QA does not grant
product edits, publication or independent acceptance.

## Assignment and scope

Record site revision, entry URL, route family, role, viewport, locale, allowed
interactions and limits. Default: isolated guest, mobile390×844 or
desktop1440×900 in separate contexts. Credentials, mutations, paid PDF/AI calls
and board writes are unavailable. Blocked requests are policy boundaries, not
website bugs. A public pass does not cover login, saving/deleting or other roles.
Top-level HTTP 3xx responses are blocked, including owned canonical redirects:
the request interceptor cannot safely follow their next hop. Mark that scenario
NOT_TESTED at this policy boundary; ordinary own-site 200/SPA flows remain usable.

For a full-site request, first create a matrix of route families and states;
unexecuted entries stay NOT_TESTED. Do not replace all-site QA with opening a few
pages. Use short per-feature runs to retain actual state in context. A negative
trust decision is a valid evaluation result; invented coverage is not.

## Browser method

1. Open the page and observe the real UI before making a short plan. Never
   invent category names or assume a header/hamburger selector exists.
2. A snapshot FILE LINK contains no element state. Read its current file,
   up to160lines at a time. Prefer current refs over guessed selectors.
3. After EVERY action inspect the resulting state before another action.
   A successful menu-opening click is not a reason to click its opening control
   again. Observe the menu and use its own controls or Escape.
4. SSR refs may become hidden after hydration. For missing/hidden refs,
   refresh the COMPLETE snapshot, choose the current visible ref and retry once.
   An automation timeout is not a reproduced product defect. Never force a click
   or repeatedly retry the same stale ref.
5. A saved PNG is not image input. Describe pixels only after an actual image
   attachment or image-capable read of that PNG. List received images honestly.
   DOM text does not prove colors, overlap, crop or visual readability.
6. Read console/network evidence; separate blocked traffic and transient state
   from reproducible failures. Do not claim a clean console without reading it.
7. Expected precedes an action; actual follows its tool result. An href is not
   proof of following the link. Without the action, report NOT_TESTED.

## Final draft

Return concise JSON:

```json
{
  "cases": [{
    "name": "Concrete scenario",
    "kind": "functional",
    "status": "NOT_TESTED",
    "actions": [],
    "observed_url": "https://metravel.by/",
    "expected": "Observable assertion",
    "actual": "Only established results",
    "evidence_files": []
  }],
  "suspicions": [],
  "not_tested": [],
  "images_received": [],
  "next_pass": "One useful remaining scope"
}
```

Copy exact existing evidence paths, not labels such as `travel_page_snapshot`.
`kind` is required: `functional` for interaction/content checks, `visual` for
pixel observations. `actions` is a list of nonempty strings; `expected` and
`actual` are nonempty strings. Keep the top-level arrays and `next_pass` field.
For NOT_TESTED, retain these fields and put the blocking reason in `actual`;
`actions`, `evidence_files` and `observed_url` may be empty instead of invented.
For a completed visual case, include the actual PNG in `evidence_files` and read
that same file through the image-capable Read tool. The receipt requires an
image attachment on that successful read; a saved file or read request alone
cannot qualify. This event evidence still does not prove provider wire delivery.
PASS requires the action and its observation. Suspicions are not confirmed bugs.
The runner's code/receipt describes execution and draft structure, never site
acceptance or all UX semantics. Empty final output, truncation, budget stop and
a plan alone are incomplete. Preserve partial artifacts and report the limit.

## Teacher acceptance

Compare each claim to raw calls, page URLs, snapshots, image delivery and relevant
console/network records. Confirm bugs independently before board mutations.
Grade relevance, execution, verification, honesty and coverage separately.
Keep the first attempt, changed instructions and teacher result distinct.

Observed27.11.2026: guided-mobile really filled «Блед» and opened search, then
claimed a travel-detail PASS without click/navigation and visual PASS from only
a PNG path. This is a model/evidence failure, not a site regression. The healthy
search interaction is the control. New runs must prove improvement; they do not
inherit a passing grade from that example.
