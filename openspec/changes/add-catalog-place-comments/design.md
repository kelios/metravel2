## Context

The catalog has a stable representative point ID and canonical place identity when linked. The active article is UI state and must not change the discussion.

## Goals / Non-Goals

- One discussion per canonical physical place. Unlinked point comments remain addressable and become visible on linking without guessing identity.
- Reuse modal, auth, plain-text comment, moderation and blocking primitives.
- No replies, likes, media, notifications, or automatic data grouping.

## Decisions

- Open from the catalog card beside the rating, outside the main action row. Mount discussion data only for the active place.
- Request `GET /api/places/{point_id}/comments/` with cursor, `POST` with plain text, and `DELETE /api/places/{point_id}/comments/{comment_id}/`. The server resolves identity and visibility. Partition cached data by actor and place, use the existing safety invalidation pattern, and never hide errors as empty data.
- Keep the composer draft on a transient send failure. After a `201` clear the submitted draft and refetch the list. A POST-only `is_hidden: true` shows a moderation notice while the GET list remains authoritative for visibility. Use existing content safety controls.
- Initially ship catalog support; other place surfaces can reuse the discussion later.

## Risks / Trade-offs

- Invalid or hidden points must not expose private discussions → backend access checks and frontend error handling.
- Extra controls in dense cards → separate rating-area action and mobile-first browser QA.
- Rollback removes the UI entry point while retaining comments and existing article/rating behavior.
