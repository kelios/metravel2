# TASK-20260609-037: Gunicorn port 8000 exposed publicly, bypasses nginx

Status: Backlog
Owner: Backend
Support: Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Remove the public `ports: "8000:8000"` mapping from the app container in production so
that Gunicorn is reachable only from within the Docker network, and all external traffic
must pass through nginx (TLS termination, rate limiting, security headers).

## Context

`docker-compose-prod.app.yaml:19-20` publishes `ports: "8000:8000"`. nginx is configured
with `network_mode: host`, meaning both nginx and the host can already reach Gunicorn on
`127.0.0.1:8000`. The explicit `ports` mapping additionally binds `0.0.0.0:8000` on the
host interface, making Gunicorn directly reachable by any external IP that can reach the
server — bypassing nginx rate-limiting, TLS, HSTS, X-Frame-Options and other security
headers that nginx applies.

An attacker (or aggressive bot) reaching `http://server-ip:8000/` receives raw Django
responses without any of those protections.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `docker-compose-prod.app.yaml` does not publish port 8000 to `0.0.0.0` (no `ports: "8000:8000"` or equivalent).
- [ ] Gunicorn binds to `127.0.0.1:8000` (loopback) or is reachable only on the internal Docker network.
- [ ] `curl http://<public-server-ip>:8000/` from an external host returns connection refused or timeout.
- [ ] `curl https://metravel.by/api/` continues to work correctly through nginx.
- [ ] nginx can still proxy to Gunicorn on the internal address.

## Gherkin Tests

```gherkin
Feature: Gunicorn not directly accessible from the internet

  Scenario: Direct connection to port 8000 from external IP is blocked
    Given the production docker-compose is deployed without public port 8000
    When an external host attempts to connect to http://<server-ip>:8000/
    Then the connection is refused or times out

  Scenario: API remains accessible via nginx
    Given nginx proxies /api/ to Gunicorn on the internal address
    When GET https://metravel.by/api/travels/ is called
    Then the response status is 200
    And response headers include X-Frame-Options and Strict-Transport-Security

  Scenario: Rate limiting still applies
    Given nginx rate-limit rules are active
    When 100 rapid requests are made to https://metravel.by/api/
    Then nginx returns 429 for excess requests
    And Gunicorn is never reached directly by those excess requests
```

## Assignment

Primary owner: Backend Developer
Support agents: Reviewer (infrastructure security review), Releaser (production deployment + firewall check)

## Likely Files Or Areas

- `docker-compose-prod.app.yaml` (lines 19-20 — remove `ports:` from app service)
- `deploy/prod/app/entrypoint.sh` (verify Gunicorn bind address: should be `127.0.0.1:8000` or socket)
- `nginx/` config (confirm upstream points to `127.0.0.1:8000` or internal Docker hostname)
- Server firewall / UFW rules (verify 8000 is blocked at OS level as defence-in-depth)

## Plan

1. Remove or replace `ports: "8000:8000"` in `docker-compose-prod.app.yaml`.
   - If nginx uses `network_mode: host` and can reach `127.0.0.1:8000`, simply delete the `ports:` entry.
   - If containers are on a user-defined bridge network, expose via `expose: ["8000"]` (internal only).
2. Verify `entrypoint.sh` binds Gunicorn to `127.0.0.1:8000` (not `0.0.0.0:8000`).
3. Confirm nginx upstream directive references the correct address/socket.
4. Add UFW rule `ufw deny 8000` as defence-in-depth.
5. Deploy to preprod, test: external 8000 → refused, nginx 443 → 200.

## Validation

```bash
# After deploy: external port 8000 must be closed
nc -zv <server-ip> 8000
# Expected: Connection refused

# HTTPS via nginx still works
curl -I https://metravel.by/api/travels/
# Expected: HTTP/2 200, X-Frame-Options present

# Check Gunicorn bind address in running container
docker exec <app-container> ss -tlnp | grep 8000
# Expected: 127.0.0.1:8000 (NOT 0.0.0.0:8000)
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
