# TASK-20260609-068: Fix nginx SSR redirect-cycle 500 on non-prerendered dynamic routes

Status: Backlog
Owner: Backend
Support: Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

> FE changes: NOT required. This is a prod-nginx config fix owned by Backend.
> Applying it touches prod nginx — requires explicit confirmation before deploy
> (do NOT hot-edit prod nginx as part of this task without sign-off).

## Goal

Real article/travel URLs that do not have a prerendered static `.html` in the Expo
export must return HTTP 200 (SPA shell), not HTTP 500. Eliminate the nginx
`rewrite or internal redirection cycle` triggered by the literal `/travels/[param].html`
(and `[id].html` / `[city]/[questId].html`) `try_files` fallback.

## Context

Symptom: real URLs return 500 to users, search engines and social-card bots
(`facebookexternalhit`/Meta). nginx logs:
`rewrite or internal redirection cycle while internally redirecting to "/travels/[param].html"`.

Reproduced read-only against prod (2026-06-09):

- `https://metravel.by/travels/holopenichi` -> **500** (no prerendered `holopenichi.html`)
- `https://metravel.by/travels/krakov-karer-zakshuvek` -> 200 (this slug has a prerendered `.html`)
- `https://metravel.by/travels` (bare) -> 200 (handled by a separate location)

Root cause — `deploy/prod/nginx/nginx.conf` (paths/lines are in the **backend** repo
`D:\metravel\metravel-backend`):

- `deploy/prod/nginx/nginx.conf:259` `location ~ ^/travels/.+ { ... }`
- `deploy/prod/nginx/nginx.conf:267`
  `try_files $uri.html $uri/index.html $uri /travels/[param].html;`

The last `try_files` argument is an **internal URI** (starts with `/`), so when none of
`$uri.html` / `$uri/index.html` / `$uri` exist on disk, nginx performs an internal
redirect to `/travels/[param].html`. That new request again matches
`location ~ ^/travels/.+` (because `[param].html` matches `.+`), reaches the same
`try_files`, still finds no matching file, redirects to `/travels/[param].html` again →
infinite internal-redirect cycle → nginx returns 500.

The literal `[param].html` is the Expo placeholder file for the dynamic route — it is
intended as the SSR/SPA fallback shell, but referencing it as a `try_files` *URI* inside a
location that itself matches that URI is what creates the loop.

Same latent bug in the sibling dynamic-route locations:

- `deploy/prod/nginx/nginx.conf:284` (`/article/.+` → `/article/[id].html`)
- `deploy/prod/nginx/nginx.conf:301` (`/user/.+` → `/user/[id].html`)
- `deploy/prod/nginx/nginx.conf:316` (`/quests/[^/]+/[^/]+` → `/quests/[city]/[questId].html`)

These only 500 when the requested slug/id has no prerendered static file (new or
not-yet-exported content) — exactly the long tail that SEO/social crawlers hit.

Note: `error_page 404 /+not-found.html;` (`nginx.conf:186`) is unrelated and fine.

Source task:

- Source id: BE-053
- Source path: docs/BACKEND_WORKBOARD.md

## Acceptance Criteria

- [ ] `GET https://metravel.by/travels/<non-prerendered-slug>` (e.g. `holopenichi`) returns
      200 with the SPA/SSR HTML shell (not 500, no redirect cycle).
- [ ] `GET https://metravel.by/travels/<prerendered-slug>` (e.g. `krakov-karer-zakshuvek`)
      still returns 200 and still serves its specific prerendered `.html` (meta/og tags
      preserved — no regression of the SEO behavior the location was built for).
- [ ] Same fix applied consistently to `/article/.+`, `/user/.+`, and `/quests/.+/.+`
      locations so none of them can enter a redirect cycle.
- [ ] No `rewrite or internal redirection cycle` entries appear in nginx error.log after
      the change for these routes.
- [ ] `nginx -t` passes; only the `app`/`nginx` prod stack is affected (no DB/model/
      migration changes; no FE changes required).

## Gherkin Tests

```gherkin
Feature: SSR fallback for dynamic web routes without prerendered HTML

  Scenario: Travel slug without a prerendered static page
    Given the Expo export has no "holopenichi.html" under the travels directory
    When a crawler requests "https://metravel.by/travels/holopenichi"
    Then the response status is 200
    And the body is the SPA/SSR HTML shell
    And nginx error.log records no "internal redirection cycle" for that request

  Scenario: Travel slug with a prerendered static page (no regression)
    Given the Expo export contains "krakov-karer-zakshuvek.html"
    When a client requests "https://metravel.by/travels/krakov-karer-zakshuvek"
    Then the response status is 200
    And the served HTML is the slug-specific prerendered page (its own canonical/og tags)

  Scenario: Article and quest dynamic routes are loop-free too
    Given an article id or quest path with no prerendered static file
    When the URL is requested
    Then the response status is 200 and there is no redirect cycle
```

## Assignment

Primary owner: Backend (Sergey / Codex)
Support agents: Tester, Reviewer, Releaser

## Likely Files Or Areas

- `deploy/prod/nginx/nginx.conf:259-274` (`/travels/.+` location — the active loop)
- `deploy/prod/nginx/nginx.conf:276-291` (`/article/.+`)
- `deploy/prod/nginx/nginx.conf:293-306` (`/user/.+`)
- `deploy/prod/nginx/nginx.conf:308-321` (`/quests/[^/]+/[^/]+`)
- (all in the backend repo `metravel-backend`, mounted on prod at
  `/home/sx3/metravel/deploy/prod/nginx/nginx.conf` and bind-mounted into `metravel_nginx_1`)

## Plan

(Owner-implemented; this task is descriptive — do NOT hot-edit prod nginx without sign-off.)

1. Break the self-referential fallback so the placeholder is served WITHOUT re-entering the
   same regex location. Recommended options (pick one, keep SEO behavior intact):
   - Serve the placeholder as a **named location**: define
     `location @travels_fallback { ... try_files /travels/[param].html =404; }` (a named
     location is not matched by request URIs, so no cycle) and use
     `try_files $uri.html $uri/index.html $uri @travels_fallback;`.
   - Or use an **exact internal location** for the placeholder file and an `internal;`
     directive so it cannot be reached by an external/looping request, e.g.
     `location = /travels/[param].html { internal; }`.
   - Or rename/serve the Expo placeholder via a non-matching path so the final `try_files`
     target never re-matches `^/travels/.+`.
2. Apply the same pattern to `/article/.+`, `/user/.+`, `/quests/.+/.+`.
3. `nginx -t` to validate config.
4. Reload nginx on prod (graceful) — coordinate timing; this is prod infra.

### Prod apply checklist (owner runs — read-only diagnosis already done)

```bash
ssh sx3@178.172.137.129
cd /home/sx3/metravel
# edit deploy/prod/nginx/nginx.conf (or pull the committed fix)
docker exec metravel_nginx_1 nginx -t
docker exec metravel_nginx_1 nginx -s reload    # graceful, no downtime
# verify
curl -s -o /dev/null -w '%{http_code}\n' https://metravel.by/travels/holopenichi          # expect 200
curl -s -o /dev/null -w '%{http_code}\n' https://metravel.by/travels/krakov-karer-zakshuvek # expect 200
docker logs metravel_nginx_1 --tail 50 | grep -i 'redirection cycle'  # expect empty
```

## Validation

- `GET /travels/holopenichi` → 200 (was 500).
- `GET /travels/krakov-karer-zakshuvek` → 200, still slug-specific HTML.
- `GET /article/<unknown-id>` and `GET /quests/<city>/<unknown-quest>` → 200, no cycle.
- nginx error.log clean of `internal redirection cycle` for these routes.
- `nginx -t` OK; `nginx -s reload` succeeds.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created. Root cause confirmed in `nginx.conf:267` self-referential
  `try_files ... /travels/[param].html`. Reproduced read-only on prod:
  `/travels/holopenichi` -> 500, `/travels/krakov-karer-zakshuvek` -> 200.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
