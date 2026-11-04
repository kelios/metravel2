## Context

The compact subscriber DTO includes identity and avatar. Compact subscription rows also include previews. Only the status endpoint can confirm a reciprocal relationship.

## Goals / Non-Goals

Use one compact GET per requested page and one status GET for the open public author. The invitation picker keeps its unpaginated directory.

## Decisions

- Keep independent owner-scoped infinite queries for both tabs. An inactive tab stops observing its query. The server count supplies the total independently of loaded rows.
- Pass the abort signal to the API and increment the page number only if the server exposes a next link. Preserve item references through React Query structural sharing.
- Show a neutral disclosure on subscriber rows. It loads one exact status after explicit activation and exposes the existing mutation control only after a successful status read.
- Use one optimistic status mutation, including rollback and invalidation for the relevant owner, author and lists.

## Risks / Trade-offs

Name filtering applies to loaded rows, since the compact API has no name filter. Loading another page keeps the filter active. Compact subscribers omit contact links. Those links are available on the public profile subject to its visibility policy.
