# TASK-20260609-023: Encrypt Instagram access tokens at rest in the database

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Protect Instagram long-lived access tokens stored in `InstagramGraphAccount` from
database-level exposure by encrypting them at rest, so that a database dump or SQL
injection does not yield usable IG credentials.

## Context

Security review 2026-06-09. `travels/models.py:389`:

```python
class InstagramGraphAccount(models.Model):
    access_token = models.TextField()   # long-lived IG token, plaintext
```

Instagram long-lived tokens are valid for 60 days (renewable). A compromised token gives
full read/write access to the connected Instagram account via the Graph API. If the
production database is exfiltrated (SQL injection, backup leak, DB host compromise), all
stored tokens are immediately usable by an attacker.

The fix is field-level encryption. The standard Django approach is
[django-encrypted-model-fields](https://pypi.org/project/django-encrypted-model-fields/)
(Fernet symmetric encryption, key from env) or equivalent. The existing plaintext values
must be migrated: a data migration reads each row, encrypts the token with the new key,
and writes it back.

The encryption key must be stored in an environment variable (never in source), and the
application should fail to start if the key is absent (same pattern as `SECRET_KEY` in
task 014).

No frontend API contract changes — the token is an internal server-side credential, never
sent to the client.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `InstagramGraphAccount.access_token` is stored encrypted in the database (ciphertext,
      not plaintext). Selecting the column directly in psql shows an opaque string, not a
      readable IG token.
- [ ] The encryption key is sourced from an environment variable
      (e.g. `FIELD_ENCRYPTION_KEY`) and is not present in any source file.
- [ ] A data migration encrypts all existing plaintext token rows.
- [ ] After migration, the Instagram Graph API integration continues to function: the
      application can decrypt the token and make authenticated Graph API calls.
- [ ] If `FIELD_ENCRYPTION_KEY` is absent at startup, the application raises
      `ImproperlyConfigured` or equivalent and does not start.
- [ ] The encryption key is rotated as part of this task deployment (the old plaintext
      values in any database backup are treated as potentially compromised).

## Gherkin Tests

```gherkin
Feature: Instagram access tokens are encrypted at rest

  Scenario: Token is not readable in plaintext from the database
    Given an InstagramGraphAccount record exists
    When the access_token column is read directly from the database (e.g. via psql)
    Then the value is an opaque ciphertext, not a readable Instagram token string

  Scenario: Application can still use the token after encryption
    Given the token is stored encrypted and the encryption key is available
    When the backend calls the Instagram Graph API using the stored token
    Then the API call succeeds (the token is correctly decrypted before use)

  Scenario: Missing encryption key prevents startup
    Given the FIELD_ENCRYPTION_KEY environment variable is not set
    When the Django process starts
    Then it raises ImproperlyConfigured and does not serve requests
```

## Assignment

Primary owner: Backend developer — add field encryption library, update model, write data
migration.
Support agents: Operator to generate and deploy `FIELD_ENCRYPTION_KEY` env var before
migration; Tester to verify encrypted storage and functional IG API calls post-migration.

## Likely Files Or Areas

- `travels/models.py` line 389 (`InstagramGraphAccount.access_token`)
- `travels/migrations/` — new data migration to encrypt existing rows
- `metravel/envs/common/settings.py` — add `FIELD_ENCRYPTION_KEY` env var read + guard
- `requirements.txt` / `Pipfile` — add `django-encrypted-model-fields` (or chosen lib)
- `instagram_graph_service.py` — verify token retrieval and usage path still works

## Plan

1. Add `django-encrypted-model-fields` (or `cryptography` + custom descriptor) to
   requirements.
2. Generate a Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
3. Add `FIELD_ENCRYPTION_KEY = os.getenv('FIELD_ENCRYPTION_KEY')` to settings with an
   `ImproperlyConfigured` guard.
4. Change `access_token = models.TextField()` to the encrypted field type.
5. Create a schema migration (column type may change) and a data migration that reads
   each existing plaintext value, encrypts it, and writes back.
6. Test: verify psql shows ciphertext; verify IG API call succeeds in staging.
7. Set `FIELD_ENCRYPTION_KEY` in prod env and run migrations at deploy time.

## Validation

```bash
# After migration: verify ciphertext in DB (run on prod/staging DB)
# psql -c "SELECT id, left(access_token, 20) FROM travels_instagramgraphaccount LIMIT 5;"
# Expected: values start with 'gAAAA' (Fernet prefix), not 'IGQV...' (raw IG token)

# Verify IG API still works (if IG integration has a health/test endpoint)
curl -s -H "Authorization: Token ADMIN_TOKEN" \
  "https://metravel.by/api/instagram/accounts/" | python3 -m json.tool
# Expected: account list returned without error

# Verify app fails without key (staging only — unset env var and restart)
# Expected: ImproperlyConfigured in startup logs, no 200 responses
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
