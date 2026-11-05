## Context

The shared role is in `.claude/agents/reel-animator.md`. Its skill and references are in `.claude/skills/metravel-animated-reels`. The local failed pilot's montage JSON and `ffprobe` identify three JPEGs and no audio. The package QA also found an invalid facial reference and likeness drift.

## Decisions

- Keep the role thin and let the shared skill own the stage order. Put the shot/audio contract, renderer preflight and acceptance in production instructions, premise and facts in the season, and a concrete worked pilot beside them. A provider-specific role chain would duplicate policy and give runtimes different results.
- Sequence scene intent → timing and speech → keyframes → one render probe → individual shots → edit and review. A still-image montage is a timing artifact. Preserve the existing montage tool for its callers. A one-pass whole episode generation would make identity, dialogue and continuity hard to isolate and repair.
- Use verified stills or approved character sheets as visual anchors and use a permitted recording or approved distinct voice source. Cut to the active speaker and use listener reactions or motivated inserts if the renderer can only animate one person at a time. A provider failure stops that route and leaves a labeled draft.
- Keep Grok and the skill mirror generated. Add a thin Codex delegate pointing to the same role. Route episodic animation before the existing live-footage workflow.

## Risks and validation

- Likeness drift, fused dialogue or wasted credits → test a representative speaking/action shot with the intended reference and sound before the batch.
- Unauthorized input transfer or audio → record the actual tool/account, permissions and applicable project gate before sending assets or spending credits.
- Validate the source and mirrors with the project prompt audit, the skill validator and sync checks. Walk through the existing failed export and the new pilot plan against the observable requirements. Final media acceptance requires a separate rendered export.
- No application runtime surfaces or locale resource changes. API verification is read-only provenance for the worked episode. SEO, client accessibility, analytics and Core Web Vitals are outside this prompt change. Media accessibility is covered by timed subtitles and muted playback.
- Roll back the task-owned prompt edits and regenerate the mirrors. Existing drafts and montage callers require no migration.
