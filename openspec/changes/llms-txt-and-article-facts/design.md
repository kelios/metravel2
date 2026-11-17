## Context

Nginx already tries the exact URI in the exported web root. A neighboring `.txt` file returns 200 as `text/plain`. Article bodies are stored as editorial HTML.

## Goals / Non-Goals

Serve a static index and publish approved facts through the existing article workflow. Out of scope are new facts, API schema, crawler policy, and author narrative changes.

## Decisions

- Put the index in `public/` and include it in the shared export copier. A dynamic route would add an unnecessary runtime dependency.
- Extend the post-deploy SEO check to verify status, redirects, MIME type and Markdown shape independently of its page limit.
- Rank by finalized Google Search Console web clicks, using impressions for ties. Select the highest-ranked owner-authored articles with source facts. Keep date-sensitive values qualified and use row headers in two-column tables.
- After approval, dry-run each body change against the current article revision, back up before applying, and use the saved body to roll back. Validate the resulting raw public HTML of every article. Use one mobile and one desktop visual sample if table layout differs.
- Give semantic row headers a readable minimum width in the web article typography. This keeps short labels intact while allowing longer labels and values to wrap.

## Risks / Trade-offs

Stale prices and schedules need their source dates. The article write and public HTML sanitizer must preserve table semantics. A technical rollback removes the static file and its regression probe together and redeploys the previous behavior.
