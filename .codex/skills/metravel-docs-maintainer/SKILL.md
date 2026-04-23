---
name: metravel-docs-maintainer
description: Maintain metravel project documentation and Codex operating rules. Use when Codex needs to update docs/, AGENTS.md, .codex/skills, project instructions, workflow rules, skill metadata, or documentation structure in this repository.
---

# Metravel Docs Maintainer

Read `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, and `docs/CODEX.md` before changing documentation or Codex skills.

Use the AI task triage and self-check in `docs/CODEX.md` to keep docs changes scoped before editing.

Keep documentation compact and authoritative:

- Prefer updating existing canonical docs over creating new files.
- Use `docs/RULES.md` for mandatory project rules and policies.
- Use `docs/README.md` for quick navigation, setup, and API reference.
- Use `docs/DEVELOPMENT.md`, `docs/TESTING.md`, and `docs/RELEASE.md` for workflow-specific details.
- Use `docs/CODEX.md` for Codex workflow, project skill selection, and skill maintenance rules.
- Update `docs/INDEX.md` whenever adding, removing, or renaming a docs file.

Maintain skills in `.codex/skills/<skill-name>/`:

- Keep each `SKILL.md` short, procedural, and specific to one job.
- Put triggering guidance in the frontmatter `description`, because Codex sees that before loading the body.
- Do not add README, CHANGELOG, or other auxiliary files inside a skill folder.
- Add `references/` only for detailed material that should be loaded on demand.
- Keep `agents/openai.yaml` aligned with the skill name, purpose, and default prompt.

Avoid documentation drift:

- Do not duplicate the same rule in many places unless one location is a short pointer to the canonical source.
- When changing rules, update both the canonical source and the short Codex map if the skill selection or agent workflow changes.
- Preserve existing project constraints for external links, UI guardrails, server path safety, release checks, and e2e secrets.
- Do not print secrets from `.env`, `.env.e2e`, or deployment configs.
- Read Markdown as UTF-8; if PowerShell displays Cyrillic as mojibake, reread with `Get-Content -Encoding UTF8` before assuming the file is corrupt.

Validation for docs-only changes:

- Check changed Markdown/YAML files for readable structure and valid frontmatter.
- Run the skill validator for changed skills when the `skill-creator` scripts are available.
- Run broader project checks only when documentation changes also alter code, commands, governance behavior, or release policy.
