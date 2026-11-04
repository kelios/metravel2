## Decisions

Use the shared supplemental navigation and the public `/games` catalog. Preserve single-device online rounds and printable decks. Add independently loadable quiz editions and optional route tasks linked to existing article stops. Game state stays on the device for the active page.

Use an S3-backed, versioned catalog for all published JSON, previews and PDFs. No production media files in the frontend release or VPS filesystem. Load related coloring previews below the article text by stable travel ID. Each sheet depicts the article's principal place without people. Publish compact previews and A4 sheets with prebuilt thematic PDFs.

Use existing layout, typography, lazy image rendering and download patterns. See `docs/design/walk-games-and-coloring.md` and `implementation.md` for layout and format details.

## Validation and rollback

Verify publication integrity, PDF and source provenance, article mapping, game state transitions, accessibility and downloads. Test mobile web first, then desktop after review. Restore the previous manifest for rollback while its referenced files are retained.

## Walk deck media

The manifest keeps schema version 1 and adds `decks`, with `{ id, dataUrl, pdfUrl }` for each published deck. The two current IDs are `kids` and `adults`. Each immutable deck JSON contains `{ schemaVersion: 1, id, cards: [{ title, body }] }`. Eleven ordinary cards precede one finale. The current pointer and a failed deck load cannot prevent access to a valid coloring collection.

Stage and checksum-verify all objects for the new revision before replacing the pointer with a conditional write against the reviewed previous ETag. Keep the previous immutable files available for cached clients and rollback. Verify both PDFs against the online card text, the new catalog revision, and the preserved article coloring index.
