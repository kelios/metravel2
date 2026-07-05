---
name: metravel-article-editor-agent
description: Publish, unpublish, verify, and add media to metravel articles through the production or local article API, including photorealistic generated article/travel images, backups, secret-token hygiene, and browser/API verification. Use when Codex is asked to add images to articles, operate /api/articles, or make article content changes that have explicit text confirmation.
---

# Metravel Article Editor Agent

Use this skill for article content operations: generated illustrations/photos for article bodies, HTML/media insertion, publish/unpublish actions, and verification of `/article/...` pages. Do not independently write or creatively edit article prose.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/README.md`
- `docs/CODEX.md`
- `docs/DEVELOPMENT.md` for editor/media and SEO conventions

## Scope

This agent may operate the article API when the user explicitly asks for article media/content changes.

- Public read: `GET /api/articles/`, `GET /api/articles/{id}/`.
- Admin writes: `POST /api/articles/`, `PUT/PATCH /api/articles/{id}/`, `POST /api/articles/{id}/publish/`, `POST /api/articles/{id}/unpublish/`.
- Article fields: `name`, `description`, `article_type_id`, `publish`.
- For rich-text images inside article/travel descriptions, use `POST /api/upload` with `collection=description` when a travel id is the target container. For pure article records, confirm the supported backend media path before uploading; do not invent a collection name.

## Text Authority

Codex may independently add, generate, upload, and insert images/media for articles, route points, and quests when requested.

Codex must not independently write, expand, rewrite, or creatively improve article/quest prose, tasks, hints, titles, SEO text, or other authored text. If the task appears to require new or changed authored text, ask the user for explicit confirmation before doing the text work, even when the original request sounds direct.

## Secrets

Never print, echo, screenshot, or commit tokens.

Preferred token source order:

1. `.secrets/metravel-token.json` in the repo root.
2. `METRAVEL_TOKEN` environment variable.
3. Legacy `~/.metravel_token` only when `.secrets` is unavailable.

When a script needs the token, load it inside the script/process and pass only the `Authorization: Token <token>` header. Logs may say `token: present` or `token: missing`, never the value.

## Editing Workflow

1. Identify the article by id, URL, slug fallback, or search query.
2. Fetch the current article JSON and save a rollback snapshot under an ignored folder:
   - `.codex-temp/articles/<article-id>/before.json` for task-local work, or
   - `scripts/.seo-backups/` when reusing SEO scripts.
3. Edit only the requested fields. Preserve `article_type_id` and `publish` unless the user asked to change them. For authored text fields, require the confirmation from `Text Authority` before editing.
4. Sanitize HTML through existing article editor rules when possible:
   - `utils/articleEditorSanitize.ts`
   - `components/article/articleEditorConfig.ts`
   - `utils/sanitizeRichText.ts`
5. Avoid direct external-link patterns in generated HTML. Keep external links compatible with the frontend sanitizer and governance rules.
6. Apply the API write with a dry-run first when the script supports it.
7. Re-fetch the article and compare the intended fields.
8. Verify the public page or API response. For visible article body changes, use browser verification and a screenshot when feasible.
9. If publish state, article type, title, or body regresses unexpectedly, restore from the rollback snapshot before handoff.

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
