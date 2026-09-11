---
name: metravel-article-editor-agent
description: "Create, edit, publish, or add media to metravel articles and Julia travel guides via API. Use for upsert, photo folders, uploads, and owner-requested prose: отредактируй статью, путеводитель, добавь впечатления, diary notes. /article-editor"
---

# Metravel Article Editor Agent

Use this skill for article and travel-guide operations: live-text edits, photo-folder drafts, HTML/media insertion, publish/unpublish, and verification.

`AGENTS.md` is inherited. For Julia travel prose, load
`.claude/skills/metravel-travel-article/SKILL.md` and follow it — do not invent a
second style. For Grok, the matching role is `travel-writer`.

## Scope

Operate the article/travel API when the user asks for content changes.

- Public read: `GET /api/articles/`, `GET /api/articles/{id}/`, `GET /api/travels/{id}/`.
- Admin writes: `POST /api/articles/`, `PUT/PATCH /api/articles/{id}/`, `POST /api/articles/{id}/publish/`, `POST /api/articles/{id}/unpublish/`.
- Article fields: `name`, `description`, `article_type_id`, `publish`.
- Live travel body: `scripts/seo-edit.js --desc-file` (backup + verify + rollback). Do not run `metravel_publish.py` on a published travel — it unpublishes.
- New travel draft: `PUT /api/travels/upsert/` with `id:null` and `publish=false`, Julia token only.
- Description images: `POST /api/upload` `collection=description` with the travel id. For pure article records, confirm the backend media path; do not invent a collection name.

## Text Authority

Do not rewrite article/quest prose as a side effect of a code or docs task.

When the current request is to edit, write, enrich, or add impressions, distances, tips, diary, or guidebook text to a named travel (id, URL, slug, or pasted notes plus link) — that is confirmation. Do not ask again. Load `metravel-travel-article` and write.

- `userId` ≠ 1: guest article. Do not change prose. Ask the owner.
- Do not invent personal experience missing from the owner's notes, the existing article, or visible photos.
- Keep Julia's existing paragraphs and italic kickers; insert around them.
- Vague "improve my articles" with no target: ask for id or URL.

New travel records: Julia credentials from `.env.e2e` (`E2E_EMAIL2`), verify author user id `1`, `publish=false` unless publication was requested. Never print the credential. Wrong author → documented `DELETE` + recreate, never spoof authorship in the payload.

## Secrets

Never print, echo, screenshot, or commit tokens. Logs may say `token: present` or `token: missing`.

- Author-bearing writes (new travel, editorial comment, gallery captions under Julia): Julia token.
  `METRAVEL_TOKEN=$(E2E_EMAIL=$E2E_EMAIL2 E2E_PASSWORD=$E2E_PASSWORD2 node scripts/get-quest-token.js | tail -1)`
- Body-only `seo-edit` on Julia's article preserves author; default `.secrets/metravel-token.json` / `~/.metravel_token` is Sergey (id 104) and must not create articles or post the editorial comment.

## Editing Workflow

1. Identify by id, URL, slug, or search. `GET` and confirm `userId`.
2. Snapshot: `scripts/.seo-backups/` via `seo-edit`, or `.codex-temp/articles/<id>/before.json`.
3. Travel prose → `metravel-travel-article` (enrichment / diary mode / photo folder). Preserve `publish` and `moderation` unless asked.
4. Sanitize through `utils/articleEditorSanitize.ts` / `utils/sanitizeRichText.ts` when generating HTML. Keep external links sanitizer-compatible.
5. Dry-run `seo-edit` when writing a live description, then write.
6. Re-GET: intended fields, image count, no `alt="Изображение"`.
7. SPA shows API text immediately; crawler HTML updates only after SSG rebuild — say so in the report.
8. Unexpected publish/type/title/body regression → restore from backup before handoff.

Photo-folder work still needs duplicate detection, EXIF/GPS, visible-photo checks, exact place names, a chosen cover, and final `GET` of points, countries, cover, gallery, author, publish. Diary-only edits do not require a photo folder.

## Generated Images

Do not use internet images for article assets unless the user explicitly authorizes a licensed source.

Preferred image paths:

- Reuse generated local assets already available for the project when they match the article.
- For new generated raster assets, use the `imagegen` skill built-in image tool by default; copy the generated file from `$CODEX_HOME/generated_images/...` into the task-local workspace before upload.
- Published article/travel media must look like real travel photography or a user-approved licensed/local photo. Do not generate flat SVG, Playwright screenshot, vector, icon-like, schematic, cartoon, generic illustration, or "photo-like" placeholder assets for covers, description images, gallery images, or map points.
- If photorealistic image generation is unavailable or the generated result is visibly artificial, stop before upload and report the blocker instead of substituting a stylized/local SVG fallback.
- Keep generated files in ignored folders until uploaded: `.codex-temp/articles/<article-id>/generated/`.
- Generate without embedded text unless text is explicitly required; article UI should render text.
- Upload only from local files on disk via the correct media collection (`travelMainImage`, `description`, `travelImageAddress`, or `gallery`); do not reference generated images directly from `$CODEX_HOME` or chat output.
- After upload or insertion, verify the image URL loads and the article body renders without broken media.

## Validation

For docs/content-only article API changes:

- Re-fetch edited article JSON and compare changed fields.
- Check the public `/article/<id-or-slug>` route when published.
- If images were uploaded, `HEAD` or `GET` each image URL and visually inspect at least one final render.

For code changes in article editor/frontend behavior, hand off to `$metravel-feature-builder`, `$metravel-ui-guardrails`, and `$metravel-test-runner` as needed.

## Handoff

Return an `Article Edit Report`:

- article id/title and target URL
- fields changed
- backup location
- images generated/uploaded, if any
- verification performed
- unresolved blockers or rollback notes
