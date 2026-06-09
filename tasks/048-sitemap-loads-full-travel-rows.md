# TASK-20260609-048: Sitemap loads full Travel rows instead of slug+updated_at only

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Add `.only('slug', 'updated_at').order_by('id')` to the sitemap queryset so that
generating `/sitemap.xml` fetches only the two columns it needs instead of all Travel
fields, reducing DB load and response time on every crawler visit.

## Context

`maintenance/sitemap.py:33-35` currently reads:

```python
Travel.objects.filter(publish=True, moderation=True)
```

No `.only()` or `.defer()` is applied, so Django loads every column including heavy
`TextField` columns (`description`, `plus`, `minus`, `recommendation`) for each published
travel — none of which are used to generate sitemap entries.

Prod measurement (2026-06-09):

| Metric | Value |
|---|---|
| `/sitemap.xml` response time | 0.49 s |
| `/sitemap.xml` response size | 75 KB |

Google Search Console and other crawlers re-fetch the sitemap frequently. Each fetch
causes a full-row scan of the travels table. Adding `.only()` eliminates the unnecessary
column reads; optionally caching the rendered sitemap XML for ~1 hour would further
reduce repeated hits.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] The sitemap queryset uses `.only('slug', 'updated_at')` (or equivalent `defer()` of all non-needed fields).
- [ ] `EXPLAIN (ANALYZE)` or Django `connection.queries` shows only `slug` and `updated_at` selected, not `description`/`plus`/`minus`.
- [ ] `/sitemap.xml` response is functionally identical to before (same URLs, same `<lastmod>` values).
- [ ] Response time for `/sitemap.xml` is measurably lower (target ≤ 0.20 s, down from 0.49 s baseline).
- [ ] Optionally: sitemap XML is cached for 3600 s to absorb repeated crawler hits.

## Gherkin Tests

```gherkin
Feature: Sitemap uses a slim queryset

  Scenario: Sitemap query selects only required columns
    Given the travels table contains 1000 published+moderated rows
    When /sitemap.xml is requested
    Then the SQL query selects only slug and updated_at (plus id for ordering)
    And no TextField columns are included in the SELECT

  Scenario: Sitemap content is correct
    Given 3 published travels with known slugs and update timestamps
    When /sitemap.xml is fetched
    Then the response contains exactly 3 <url> entries
    And each <loc> matches the travel slug
    And each <lastmod> matches the travel updated_at value

  Scenario: Sitemap responds faster after optimization
    Given the slim queryset is in place
    When GET /sitemap.xml is called
    Then the response is returned in under 0.20 s
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (queryset column check, content assertion), Reviewer (sitemap output correctness)

## Likely Files Or Areas

- `maintenance/sitemap.py` (lines 33-35 — Travel queryset)
- Django sitemap framework view (`django.contrib.sitemaps.views`) — optional cache decorator
- `metravel/urls.py` or equivalent — sitemap URL registration (to add cache_page if desired)

## Plan

1. Open `maintenance/sitemap.py` and change the queryset to:
   ```python
   Travel.objects.filter(publish=True, moderation=True).only('slug', 'updated_at').order_by('id')
   ```
2. Verify the sitemap class only accesses `slug` and `updated_at` in `location()` and
   `lastmod()` methods; update if any other field is referenced.
3. Optionally wrap the sitemap URL with `cache_page(3600)` in `urls.py`.
4. Run sitemap generation locally, diff output against unmodified version to confirm
   identical URLs and lastmod values.
5. Record prod response time after deploy.

## Validation

```bash
# Check column list in generated SQL (Django shell)
python manage.py shell -c "
from django.db import connection, reset_queries
from django.conf import settings
settings.DEBUG = True
reset_queries()
from maintenance.sitemap import TravelSitemap
list(TravelSitemap().get_urls())
for q in connection.queries:
    print(q['sql'][:300])
"
# Expected: SELECT ... slug, updated_at FROM travels_travel WHERE ...

# Prod timing before vs. after
curl -o /dev/null -sw "%{time_total}s\n" https://metravel.by/sitemap.xml
# Target: ≤ 0.20 s (baseline 0.49 s)

# Content sanity check
curl -s https://metravel.by/sitemap.xml | grep -c '<url>'
# Must equal number of published+moderated travels
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
