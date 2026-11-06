## Why

Readers can rate a place and browse related articles, but cannot leave a note on the physical place. Article discussions are tied to the selected article.

## What Changes

Add a lazily opened place discussion to the catalog. Guests can read; authenticated users can post plain text and delete their own comments. Use existing safety, authentication and UI primitives.

## Capabilities

### New Capabilities

- `catalog-place-comments`: reading and contributing to a place discussion from the catalog.

### Modified Capabilities

None.

## Impact

Catalog card and discussion UI, comment client/query state, safety contract and locales. Requires the linked backend place comments API. Existing article threads and rating flows stay independent.
