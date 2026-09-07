---
name: metravel-docs-maintainer
description: "Maintain metravel docs, AGENTS.md, Codex skills, and workflow rules. Use for documentation structure, instruction routing, skill metadata, duplication, drift, or context-cost cleanup."
---

# Metravel Docs Maintainer

`AGENTS.md` is inherited; do not reread it. Inspect only the canonical document
that owns the changed rule:

- mandatory policy → `docs/RULES.md` exact heading;
- docs navigation → `docs/README.md`/`docs/INDEX.md`;
- Codex routing/context/validation → `docs/CODEX.md`;
- skill catalog maintenance → `docs/CODEX_SKILLS.md`;
- OpenSpec behavior → the SDD docs and `openspec/config.yaml`.

## Edit rules

- Update an existing canonical source; avoid one-off reports.
- Keep always-on instructions short. Put detailed or conditional procedures in
  the owning doc and point to an exact heading.
- Do not copy one policy through `AGENTS.md`, `CODEX.md`, `README.md`, and every
  skill. Preserve one canonical statement plus brief conditional pointers.
- `AGENTS.md` contains only cross-task safety, scope, preflight, and handoff
  invariants that must be present on every invocation.
- `docs/CODEX.md` is a lazy router, not a complete skill catalog or operations
  manual.
- Update `docs/INDEX.md` only when docs files are added, removed, or renamed.

## Skills

- Keep `.codex/skills/<name>/SKILL.md` procedural and single-purpose.
- Frontmatter contains short `name` and `description`; description states the
  capability and concrete trigger surfaces, not the workflow.
- Assume workspace instructions are inherited. A skill must not require a shell
  reread of `AGENTS.md` or full canonical docs without task-specific need.
- Use exact-heading references and progressive disclosure.
- `agents/openai.yaml` is short UI metadata, not a second skill body.
- No README/CHANGELOG in skill folders; use `references/` only for optional
  detailed material.
- Use `$metravel-prompt-maintainer` when prompt specs, asset prompts, or
  `agents/openai.yaml` are materially changed.

## Validation

- Re-read changed Markdown/YAML for structure, links, and valid frontmatter.
- Run `npm run audit:prompts` for descriptions/default prompts/prompt specs.
- Run `skill-creator` validator for every changed skill.
- Compare line/byte or description-character counts before/after when the goal
  is context reduction; do not claim optimization without that evidence.
