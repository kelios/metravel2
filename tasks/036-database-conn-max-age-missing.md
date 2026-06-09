# TASK-20260609-036: CONN_MAX_AGE missing — new DB connection on every request

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Set `CONN_MAX_AGE` in all environment database configs so that Django reuses persistent
connections instead of opening a new PostgreSQL/PostGIS connection per request.

## Context

None of the `metravel/envs/**` settings files set `CONN_MAX_AGE` in the `DATABASES`
dict. Django's default is `CONN_MAX_AGE = 0`, which means a new TCP connection is
established and torn down for every HTTP request. With PostGIS the connection setup is
more expensive than plain PostgreSQL (spatial extension initialisation). Under moderate
traffic this adds measurable overhead and exhausts the connection pool faster.

Setting `CONN_MAX_AGE = 60` (seconds) enables persistent connections per Gunicorn worker.
For async workloads or pgBouncer deployments, `CONN_MAX_AGE = None` (unlimited) or
explicit pgBouncer session-mode pooling is an alternative.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `CONN_MAX_AGE` is explicitly set in all `metravel/envs/` settings files (dev, prod, test, preprod).
- [ ] The chosen value is at least 60 seconds (or `None` for unlimited with pgBouncer).
- [ ] A Django management command or health check confirms connections are reused: second request within the TTL does not open a new TCP connection.
- [ ] No connection leak is observed: connections are returned to the pool / closed after `CONN_MAX_AGE` expires.
- [ ] Gunicorn worker count × `CONN_MAX_AGE` does not exceed PostgreSQL `max_connections` limit.

## Gherkin Tests

```gherkin
Feature: Persistent database connections

  Scenario: DB connection is reused within CONN_MAX_AGE window
    Given CONN_MAX_AGE is set to 60 in settings
    And a Gunicorn worker handles a first request
    When a second request arrives within 60 seconds on the same worker
    Then no new TCP connection to PostgreSQL is established
    And pg_stat_activity shows the same connection pid for both requests

  Scenario: Connection is released after TTL expires
    Given CONN_MAX_AGE is set to 60
    When no request arrives on a worker for 61 seconds
    Then the old connection is closed on the next request
    And a fresh connection is established without error

  Scenario: Max connections not exceeded under full load
    Given CONN_MAX_AGE = 60 and N Gunicorn workers
    When all workers are active simultaneously
    Then pg_stat_activity count <= PostgreSQL max_connections
```

## Assignment

Primary owner: Backend Developer
Support agents: Reviewer (DB config review), Releaser (deployment verification)

## Likely Files Or Areas

- `metravel/envs/production.py` (add `CONN_MAX_AGE`)
- `metravel/envs/development.py`
- `metravel/envs/preprod.py` (if exists)
- `metravel/envs/testing.py` (can be 0 for test isolation)
- `docker-compose-prod.app.yaml` (verify no pgBouncer conflict)

## Plan

1. Open each settings file under `metravel/envs/`, locate the `DATABASES` dict.
2. Add `'CONN_MAX_AGE': 60` to the `default` database config in prod/preprod/dev.
3. Set `'CONN_MAX_AGE': 0` in the test settings to keep test isolation (each test gets a
   fresh connection from the test runner).
4. Verify `max_connections` in PostgreSQL can accommodate `workers × CONN_MAX_AGE` persistent connections.
5. Deploy to preprod, monitor `pg_stat_activity` during load.

## Validation

```bash
# Check current CONN_MAX_AGE in settings
grep -rn "CONN_MAX_AGE" metravel/envs/
# Should show the new value in prod/dev settings

# After deploy: inspect active connections on DB server
# (run in psql or via Django shell)
# SELECT count(*) FROM pg_stat_activity WHERE datname = 'metravel';

# Django shell quick check
python manage.py shell -c "
from django.db import connection
connection.ensure_connection()
print('Connection pid:', connection.connection.get_backend_pid())
"
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
