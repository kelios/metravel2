# TASK-20260609-022: Secure or remove the unauthenticated OpenAI proxy endpoint

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent financial abuse and denial-of-service on the OpenAI account by securing the
`api/chat/` endpoint with authentication and throttling, moving the API key to an
environment variable, and removing the diagnostic `print` and redundant `models.list()`
call — or removing the endpoint entirely if the feature is not in active use.

## Context

Security review 2026-06-09. `maintenance/views.py:506-557` (`ChatView`, routed at
`api/chat/`):

- No `authentication_classes` or `permission_classes` — fully public.
- On every POST: calls `client.models.list()` (line 537, an extra billed API call) and
  then `chat.completions.create(...)`. Any anonymous HTTP client can issue unlimited
  requests to OpenAI at the project's cost.
- `openai.OpenAI(api_key="api_key")` at line 535 — the key value is a placeholder
  (`"api_key"`) in the reviewed source; if a real key is ever substituted in the same
  position (or already exists in a deployed variant), it is immediately accessible via
  source control or container inspection.
- `print(...)` at line 537 — leaks request data to container logs.

**Decision point for owner:** if `api/chat/` is not used by any frontend feature
(`api/chatQueries.ts` or similar), the simplest safe fix is to remove the endpoint and
view entirely. If the feature is planned, secure it before enabling.

No frontend contract changes if the endpoint is removed (it is not referenced in the
public API used by the Expo app). If it is kept, ensure the frontend sends a token.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] **Option A (recommended if unused):** `ChatView` and its URL route are removed from
      `maintenance/views.py` and `maintenance/urls.py`; `api/chat/` returns 404.
- [ ] **Option B (if feature is needed):** `ChatView` requires `IsAuthenticated`;
      the OpenAI API key is read from `os.getenv('OPENAI_API_KEY')` and the app refuses
      to start (or logs a clear warning) if the key is absent; `client.models.list()` and
      `print(...)` are removed; a `ScopedRateThrottle` limits requests to a safe rate
      (e.g. 10/hour per user).
- [ ] Under either option, an anonymous POST to `api/chat/` returns 404 (A) or 401 (B).
- [ ] The OpenAI API key is not present in any source file committed to the repository.
- [ ] No sensitive request data appears in container stdout/stderr logs.

## Gherkin Tests

```gherkin
Feature: OpenAI proxy endpoint does not allow anonymous or unlimited usage

  Scenario: Anonymous POST is rejected (Option B) or endpoint is gone (Option A)
    Given no authentication token is provided
    When the client sends POST /api/chat/
    Then the response status is 401 or 404

  Scenario: OpenAI key is not hardcoded in source
    Given the backend source code is inspected
    When searching for openai.OpenAI(api_key= in views.py
    Then no literal key string is found; the key is sourced from environment

  Scenario: Throttle prevents cost abuse (Option B only)
    Given an authenticated user
    When they send more than the allowed number of POST requests within the throttle window
    Then subsequent requests receive HTTP 429
```

## Assignment

Primary owner: Backend developer — remove or secure ChatView + move key to env.
Support agents: Owner to decide Option A vs B; Tester to verify 404/401 and key absence.

## Likely Files Or Areas

- `maintenance/views.py` lines 506-557 (ChatView)
- `maintenance/urls.py` (api/chat/ route)
- Prod environment file / secrets manager (OPENAI_API_KEY env var, if Option B)
- Frontend (this repo): search for any `api/chat` usage — likely none

## Plan

1. Check whether any frontend code references `api/chat/` (grep this repo).
2. If unused: delete `ChatView` from `maintenance/views.py` and remove the URL from
   `maintenance/urls.py`. Confirm `api/chat/` returns 404.
3. If to be kept (Option B):
   a. Add `authentication_classes = [TokenAuthentication]`,
      `permission_classes = [IsAuthenticated]`, `throttle_scope = 'chat'`.
   b. Replace `api_key="api_key"` with `api_key=os.getenv('OPENAI_API_KEY')`.
   c. Remove `client.models.list()` call and all `print(...)` statements.
   d. Add `'chat': '10/hour'` to `DEFAULT_THROTTLE_RATES`.
4. Ensure no API key string remains in any tracked file (`git grep "api_key"`).
5. Add test for anonymous 401/404 and for key-from-env behaviour.

## Validation

```bash
# Anonymous POST must be 401 or 404
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/chat/ \
  -H "Content-Type: application/json" -d '{"message":"hello"}'
# Expected: 404 (Option A) or 401 (Option B)

# No hardcoded key in source
grep -r 'api_key="api_key"' ../metravel-backend/maintenance/views.py
# Expected: no output

# No literal openai key in git history (run on backend repo)
# git log -p | grep 'api_key=' | grep -v 'os.getenv'
# Expected: no literal key strings
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [HIGH].

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
