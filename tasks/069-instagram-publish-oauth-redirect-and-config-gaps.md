# TASK-20260609-069: Instagram publish — fix OAuth redirect mismatch and close config gaps

Status: Backlog
Owner: Backend
Support: Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-10

## Goal

Make admin "Publish travel to Instagram" actually work end to end: the backend Instagram
Graph publishing pipeline is already implemented, but the OAuth connect step can never
complete because the frontend's `redirect_uri` does not match any backend route, and the
Meta credentials/redirect are not yet provisioned. Close those gaps so a superuser can
(1) connect a business Instagram account via Meta OAuth and (2) publish a single image or
a carousel from a travel gallery.

## Context

Frontend feature (read-only references, do NOT change as part of this task unless the
contract changes):

- Publish call: `metravel2/api/instagramPublish.ts:11-24` -> `POST /travels/instagram-publish/`
  with body `{ travelId, accountKey, caption, hashtags, imageUrls }`. The API base URL always
  ends in `/api` (`metravel2/utils/resolveApiBaseUrl.ts:19,24`), so the real path is
  `https://metravel.by/api/travels/instagram-publish/`.
- OAuth URL builder: `metravel2/utils/instagramOAuth.ts:7,68-79`. Default callback path is
  `/auth/instagram/callback`, so `redirect_uri` resolves to `<origin>/auth/instagram/callback`
  (e.g. `https://metravel.by/auth/instagram/callback`). Frontend env:
  `EXPO_PUBLIC_META_APP_ID=2443100196153960`,
  `EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS=[{"key":"metravelby","label":"@metravelby"}]`.

### What is ALREADY implemented on the backend (verified, read-only)

- Publish endpoint: `travels/views.py:1057-1160` — `@action(detail=False, url_path='instagram-publish')`
  on `TravelViewSet` (router base `travels`, `travels/urls.py:13`). Real path
  `/api/travels/instagram-publish/`. Superuser-gated (`request.user.is_superuser`, else 403),
  `IsAuthenticated` + `TokenAuthentication`. Writes an `InstagramPublicationLog`, dedupes
  already-published travels, maps Graph errors to 429/502/503.
- Graph publishing service: `travels/services/instagram_graph_service.py`. Implements the full
  Content Publishing flow: single image -> `POST /{ig-user-id}/media` then `/media_publish`
  (`_create_image_container`:256, `_publish_container`:287); carousel (2..10 urls) ->
  child containers with `is_carousel_item=true` + parent `media_type=CAROUSEL`
  (`_create_carousel_container`:273), container status polling (`_wait_until_ready`:299),
  permalink fetch (`_fetch_permalink`:317). Token/`ig_user_id` come from the connected
  `InstagramGraphAccount` row (`get_connected_account`:149).
- OAuth start: `travels/views.py:1009-1025` — `url_path='instagram-oauth/start'`, superuser-gated,
  returns `{authUrl}` (signed state, 600s). Real path `/api/travels/instagram-oauth/start/`.
- OAuth callback: `travels/views.py:1027-1055` — `url_path='instagram-oauth/callback'`,
  exchanges `code` -> short-lived -> long-lived token, calls `/me/accounts` to pick the
  business IG account (optionally filtered by `INSTAGRAM_GRAPH_TARGET_USERNAME`), persists
  `InstagramGraphAccount`. Real path `/api/travels/instagram-oauth/callback/`.
- Token storage / model: `travels/models.py:383-389` `InstagramGraphAccount`
  (`ig_user_id`, `access_token` TextField, `token_expires_at`, `is_active`); page token is the
  long-lived **Page** token (no further refresh needed for page tokens, but see gap 3).
  Migrations `travels/migrations/0019_instagrampublicationlog.py`,
  `0020_instagramgraphaccount.py`. Publication log model `travels/models.py:350-381`.
- Settings: `metravel/envs/common/settings.py:235-239` reads `INSTAGRAM_GRAPH_APP_ID`,
  `INSTAGRAM_GRAPH_APP_SECRET`, `INSTAGRAM_GRAPH_REDIRECT_URI`, `INSTAGRAM_GRAPH_TARGET_USERNAME`,
  `INSTAGRAM_GRAPH_API_VERSION` (default `v23.0`). Compose passes all five through
  (`docker-compose-prod.app.yaml:34-38`, `docker-compose-prod.yaml:52-56`, local equivalents).
- Tests exist: `tests/travels/test_instagram_publish_api.py`,
  `tests/travels/test_instagram_graph_service.py`.

### Root cause / what is MISSING (this is why it does not work today)

1. **OAuth redirect_uri mismatch (BLOCKER).** Frontend `redirect_uri` =
   `https://metravel.by/auth/instagram/callback` (`instagramOAuth.ts:7`), but the backend
   callback view lives at `/api/travels/instagram-oauth/callback/`. There is no
   `/auth/instagram/callback` route on the backend — grep over the whole repo finds nothing,
   and a read-only prod probe returns **404** for `GET https://metravel.by/auth/instagram/callback`
   (vs 400 "requires code and state" for `/api/travels/instagram-oauth/callback/`). Meta sends
   the user back to the `redirect_uri` registered in the app + sent in the authorize request, so
   the code is delivered to a 404 page and OAuth can never complete. Until OAuth completes,
   `InstagramGraphAccount` stays empty and every publish fails with
   `InstagramConfigurationError` ("Instagram Graph account is not connected yet").
   Pick ONE alignment and make backend + Meta app consistent:
   - Option A (preferred, no FE change): the owner sets the FE env
     `EXPO_PUBLIC_INSTAGRAM_OAUTH_REDIRECT_URI=https://metravel.by/api/travels/instagram-oauth/callback/`
     (overrides the default in `instagramOAuth.ts:69`), sets backend
     `INSTAGRAM_GRAPH_REDIRECT_URI` to the exact same value, and registers that URL as a Valid
     OAuth Redirect URI in the Meta app. This is config-only on the backend side.
   - Option B (backend route): add an nginx/Django route that maps
     `GET /auth/instagram/callback` to the existing callback action (or a thin proxy view) so
     the FE default works without an env override; then `INSTAGRAM_GRAPH_REDIRECT_URI` and the
     Meta app must use `https://metravel.by/auth/instagram/callback`. NB: nginx currently has no
     `instagram` location (`deploy/prod/nginx/nginx.conf` has none); a new location would be a
     prod infra change.
   Document the chosen value in `## Results` so the FE/Meta config stays in sync.

2. **Meta credentials not provisioned (BLOCKER until set).** `INSTAGRAM_GRAPH_APP_ID`,
   `INSTAGRAM_GRAPH_APP_SECRET`, `INSTAGRAM_GRAPH_REDIRECT_URI`, `INSTAGRAM_GRAPH_TARGET_USERNAME`
   default to empty (`common/settings.py:235-238`). If unset, OAuth start returns 503
   ("must be configured"). These are owner-provided secrets that must be present in the prod
   env file the compose stack reads. App id must equal FE `EXPO_PUBLIC_META_APP_ID`
   (`2443100196153960`); target username should be `metravelby` to match the configured account.
   No `.env.example` exists in the backend repo documenting these keys — add one (or the owner's
   prod env template) listing the five `INSTAGRAM_GRAPH_*` vars with safe placeholder values, so
   provisioning is repeatable. Do NOT hardcode the secret in code or compose.

3. **No long-lived token refresh / expiry handling.** `InstagramGraphAccount.token_expires_at`
   is stored but never used; there is no management command or scheduled job to re-exchange the
   long-lived token before expiry, and `publish_album` does not check expiry before calling Graph.
   Page tokens derived from a long-lived user token are typically long-lived, but if the user
   token used in `/me/accounts` expires (~60 days) re-auth is required. Add either: (a) a
   management command `refresh_instagram_token` that re-exchanges and updates the row, plus a note
   on cadence; and/or (b) a pre-publish expiry check that returns a clear "reconnect Instagram"
   error (503) instead of a raw Graph failure. Owner decision: minimum is the clear error;
   refresh command is the better fix.

4. **Scope drift (non-blocking, document).** FE OAuth scopes are
   `instagram_basic, instagram_content_publish, pages_read_engagement`
   (`instagramOAuth.ts:1-5`), backend builds its own authorize URL with a wider set
   (`+pages_show_list, +business_management`, service `REQUIRED_SCOPES`:34-40). Since the backend
   `instagram-oauth/start` is the canonical flow that returns `authUrl`, the FE-built URL should
   not be used for the real connect; confirm the admin UI calls `instagram-oauth/start` (returns
   `{authUrl}`) rather than `buildInstagramOAuthUrl`. If the FE-built URL is the one actually
   used, its scopes are insufficient for `/me/accounts` (needs `pages_show_list`) and account
   selection will fail. This is a contract clarity item — note the authoritative path in Results.

5. **No public-domain validation of imageUrls (defense-in-depth).** `_validate_image_urls`
   (`instagram_graph_service.py:236-253`) only checks reachability/content-type. Meta must be able
   to fetch each URL over public HTTPS; the serializer (`serializers.py:382-387`) accepts any
   `URLField` up to 10 items. Optionally restrict to the `metravel.by` host (or an allowlist) to
   prevent an admin from passing private/LAN URLs that Meta cannot reach (the FE already only
   sends public metravel.by URLs). Low priority.

Source task:

- Source id: orchestrator request 2026-06-09 (Instagram publish backend diagnosis)
- Source path: docs/BACKEND_WORKBOARD.md (BE-066)

## Acceptance Criteria

- [ ] OAuth `redirect_uri` is consistent across three places: the URL the user is sent to,
      backend `INSTAGRAM_GRAPH_REDIRECT_URI`, and the Meta app "Valid OAuth Redirect URIs".
      A read-only probe of that exact callback path returns 400 ("requires code and state"),
      NOT 404. (Option A is config-only; Option B adds a route — note which was chosen.)
- [ ] `INSTAGRAM_GRAPH_APP_ID/APP_SECRET/REDIRECT_URI/TARGET_USERNAME` are provisioned in the
      prod env (secrets from env/compose, never hardcoded). App id matches FE
      `EXPO_PUBLIC_META_APP_ID`. `GET /api/travels/instagram-oauth/start/` for a superuser
      returns 200 `{authUrl}` (not 503).
- [ ] A backend-documented env template (`.env.example` or owner's prod env template) lists the
      five `INSTAGRAM_GRAPH_*` keys with placeholder values.
- [ ] Token expiry is handled: at minimum, publish returns a clear "reconnect Instagram" 503 when
      the stored token is expired; ideally a `refresh_instagram_token` management command exists
      and its cadence is documented. (No migration needed — `token_expires_at` already exists.)
- [ ] The canonical connect flow is `instagram-oauth/start` -> Meta -> `instagram-oauth/callback`,
      and its scopes include `pages_show_list` (already in `REQUIRED_SCOPES`). FE/BE scope
      authority is documented; if the FE-built URL is dead code, note it for FE cleanup.
- [ ] No backend migration is required for items 1–4; if item 5 (host allowlist) is taken, it is
      serializer/service-level only (still no migration).
- [ ] No change to the publish request/response contract (`travelId, accountKey, caption,
      hashtags, imageUrls` -> `{status, account, travelId, postUrl, duplicate?}`); if any field
      changes, mark it breaking and list FE files to sync (`metravel2/api/instagramPublish.ts`).

## Gherkin Tests

```gherkin
Feature: Admin connects Instagram and publishes a travel

  Scenario: OAuth callback path is reachable
    Given the configured INSTAGRAM_GRAPH_REDIRECT_URI
    When an unauthenticated GET hits that exact callback path without code/state
    Then the backend responds 400 "requires code and state" (not 404)

  Scenario: OAuth start is configured
    Given a superuser token and provisioned INSTAGRAM_GRAPH_* env
    When the superuser GETs /api/travels/instagram-oauth/start/
    Then the response is 200 with an authUrl whose redirect_uri equals INSTAGRAM_GRAPH_REDIRECT_URI

  Scenario: Publish a single image after connect
    Given an active InstagramGraphAccount with a valid token
    And a superuser token
    When the superuser POSTs /api/travels/instagram-publish/ with one imageUrl
    Then a single media container is created and published and the response postUrl is set

  Scenario: Publish a carousel
    Given an active InstagramGraphAccount and a superuser token
    When the superuser POSTs /api/travels/instagram-publish/ with 2..10 imageUrls
    Then child containers are created with is_carousel_item and a CAROUSEL parent is published

  Scenario: Expired token gives a clear reconnect error
    Given an InstagramGraphAccount whose token_expires_at is in the past
    When the superuser POSTs /api/travels/instagram-publish/
    Then the backend returns 503 asking to reconnect Instagram (not a raw Graph 502)
```

## Assignment

Primary owner: Backend (Sergey/Codex)
Support agents: Tester, Reviewer, Releaser; Owner provides Meta app credentials + Meta app
"Valid OAuth Redirect URIs" entry (manual, in the Meta developer console).

## Likely Files Or Areas

- `metravel/envs/common/settings.py:235-239` (INSTAGRAM_GRAPH_* — already present)
- `travels/views.py:1009-1160` (oauth start/callback + publish actions — already present)
- `travels/services/instagram_graph_service.py` (publish flow, token handling, optional host allowlist)
- `travels/models.py:383-389` (`InstagramGraphAccount.token_expires_at` — reuse, no migration)
- `deploy/prod/nginx/nginx.conf` (only if Option B route is chosen — prod infra, confirm with owner)
- New: backend `.env.example` (or owner prod env template) documenting INSTAGRAM_GRAPH_*
- New (optional): `travels/management/commands/refresh_instagram_token.py`
- FE (no change unless contract changes): set `EXPO_PUBLIC_INSTAGRAM_OAUTH_REDIRECT_URI`
  to match the backend callback (env-only, owner action), `metravel2/utils/instagramOAuth.ts:69`

## Plan

1. Decide redirect alignment (Option A env-only vs Option B add route). Set
   `INSTAGRAM_GRAPH_REDIRECT_URI` and the Meta app redirect entry to the same exact URL.
2. Provision the five `INSTAGRAM_GRAPH_*` env vars in prod (secrets via env/compose). Add a
   backend env template documenting them.
3. Add token-expiry handling: pre-publish check returning a clear 503, and/or a
   `refresh_instagram_token` management command; document cadence.
4. Confirm the admin connect flow uses `instagram-oauth/start` (authoritative scopes incl.
   `pages_show_list`); note FE-built URL authority / dead code.
5. (Optional) Restrict `imageUrls` to a public-host allowlist in serializer/service.
6. Verify per `## Validation`.

## Validation

Backend (owner/dev, with provisioned env and a superuser token):

```bash
# OAuth start should be 200 with authUrl (not 503) once env is set
curl -s -H "Authorization: Token <superuser>" \
  https://metravel.by/api/travels/instagram-oauth/start/

# Callback path must exist (400, not 404) at whatever INSTAGRAM_GRAPH_REDIRECT_URI is
curl -s -o /dev/null -w "%{http_code}\n" "<INSTAGRAM_GRAPH_REDIRECT_URI without query>"

# Full connect: open authUrl in a browser as the Meta admin, complete OAuth,
# confirm an active InstagramGraphAccount row exists (django shell).

# Publish single + carousel with a real travel's public image urls (superuser token).
APP_ENVIRONMENT=test uv run pytest tests/travels/test_instagram_publish_api.py tests/travels/test_instagram_graph_service.py
```

Read-only repro already captured by the diagnosing agent (prod, 2026-06-09):
`GET /api/travels/instagram-publish/` -> 401, `/api/travels/instagram-oauth/start/` -> 401,
`/api/travels/instagram-oauth/callback/` -> 400, `GET /auth/instagram/callback` -> **404**
(the FE redirect target does not exist on the backend).

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from read-only backend diagnosis. Publish pipeline + OAuth views are
  implemented; the blocker is the redirect_uri mismatch (FE `/auth/instagram/callback` 404 vs
  backend `/api/travels/instagram-oauth/callback/`) plus unprovisioned Meta credentials.
- 2026-06-09 (FE side fixed in metravel2): the frontend no longer builds its own OAuth URL.
  The publish step now (a) calls `GET /api/travels/instagram-oauth/start/` to obtain the
  authUrl ("Подключить Instagram" button), so the redirect_uri is fully owned by the backend,
  and (b) calls `POST /api/travels/instagram-publish/` on "Опубликовать" (previously the button
  only opened OAuth and never published). Files: `api/instagramPublish.ts`,
  `components/travel/InstagramPublishPanel.tsx`, `components/travel/TravelWizardStepPublish.tsx`
  (+ test). So the remaining work is purely backend creds + the finding below.
- 2026-06-09 (CRITICAL finding for @metravelby): a valid Meta **user** token with full scopes
  (`instagram_basic, instagram_content_publish, pages_show_list, business_management`) returns
  **`/me/accounts` = [] (no Pages)**. The IG account @metravelby is **not linked to a Facebook
  Page** that this admin manages. The backend OAuth callback resolves the IG business account
  via `/me/accounts` → `instagram_business_account`, which will therefore find **nothing** and
  store no `InstagramGraphAccount`. → Either (1) link @metravelby to a Facebook Page owned by
  the admin's Business portfolio (then the existing flow works), OR (2) the backend must also
  support the **Instagram API with Instagram Login** flow (`graph.instagram.com`, IGAA token,
  no Page required). Decide with the owner before provisioning. App used for IG-Login on FE
  read tooling: `metravelinstby` (App ID 3086350764868673), use case "Управление сообщениями
  и контентом в Instagram".

- 2026-06-10 (verified live; gaps 1, 3, 4 and the "no Page" finding are resolved — only env
  provisioning remains):
  - **Gap 1 (redirect mismatch) — RESOLVED.** FE env already sets
    `EXPO_PUBLIC_INSTAGRAM_OAUTH_REDIRECT_URI=https://metravel.by/api/travels/instagram-oauth/callback/`
    (Option A). Owner added that exact URL to the Meta app 2443100196153960 → Facebook Login →
    "Valid OAuth Redirect URIs" (done via browser 2026-06-10, saved + persisted after reload).
    Prod callback probe: `GET /api/travels/instagram-oauth/callback/` → **400** "requires code
    and state" (not 404). Backend `INSTAGRAM_GRAPH_REDIRECT_URI` must be set to the same value.
  - **The 2026-06-09 "@metravelby not linked to a Facebook Page" finding was WRONG / stale.**
    Verified in Meta Business Suite settings (portfolio "Metravel"): @metravelby is a Business IG
    account (ig_user_id **17841439584584656**) with **Connected assets → Facebook Page "MeTravel"
    (Page ID 1061059240434100)**; Julia Savran has **Full access** to both the Page and the IG
    account. So the Pages flow (`/me/accounts` → `instagram_business_account`) WILL resolve the
    account once OAuth runs. The earlier empty `/me/accounts` was a token-scope artifact (missing
    `business_management`), not a missing Page. **IGAA/Option-B is NOT needed.**
  - **Gap 3 (token expiry) — partially done on origin/master.** `instagram_graph_service.py`
    now has a pre-publish expiry check (`if account.token_expires_at and account.token_expires_at
    <= timezone.now()`). A scheduled `refresh_instagram_token` is still nice-to-have but not a
    blocker.
  - **App Review / Live mode — NOT required.** App stays in Development mode; publishing targets
    the owner's own @metravelby and Julia is an app admin, so Meta grants the scopes for her own
    assets in dev mode.
  - **ONLY remaining blocker = Gap 2 (env not provisioned). CONFIRMED live:**
    `GET /api/travels/instagram-oauth/start/` under the owner's Token → **503**
    "INSTAGRAM_GRAPH_APP_ID, INSTAGRAM_GRAPH_APP_SECRET and INSTAGRAM_GRAPH_REDIRECT_URI must be
    configured." Backend owner sets these in prod env and redeploys, exact values:
    ```
    INSTAGRAM_GRAPH_APP_ID=2443100196153960
    INSTAGRAM_GRAPH_APP_SECRET=<App Secret — Meta App 2443100196153960 → Settings → Basic → Show>
    INSTAGRAM_GRAPH_REDIRECT_URI=https://metravel.by/api/travels/instagram-oauth/callback/
    INSTAGRAM_GRAPH_TARGET_USERNAME=metravelby
    ```
    After deploy: superuser opens the wizard "Подключить Instagram" → completes Meta OAuth →
    `InstagramGraphAccount` row is stored → publish works. Re-run the `start/` probe to confirm
    200 `{authUrl}` (not 503).

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
