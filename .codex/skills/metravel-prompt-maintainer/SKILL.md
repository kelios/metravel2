---
name: metravel-prompt-maintainer
description: "Audit or update metravel prompt specs, asset PROMPT.md files, skill descriptions, and agents/openai.yaml. Use for prompt drift, duplication, reproducibility, stale wording, or token-heavy metadata."
---

# Metravel Prompt Maintainer

`AGENTS.md` is inherited. Load `docs/CODEX.md#skill-maintenance` and only the
canonical prompt family or skill being changed. Add `$metravel-docs-maintainer`
when routing or project-wide documentation also changes.

## Artifact ownership

- `docs/*PROMPTS.md`: canonical family spec.
- `assets/**/PROMPT.md`: concrete reproducible instance.
- `.codex/skills/*/SKILL.md`: operational behavior and non-obvious constraints.
- `.codex/skills/*/agents/openai.yaml`: short UI metadata and one-sentence prompt.
- `.agents/skills/*/SKILL.md`: shared project procedures; matching
  `.claude/skills` files are compatibility copies. Keep non-vendor copies in
  sync; preserve OpenSpec adapter differences.
- `.github/skills/metravel-*/SKILL.md`: hand-maintained Copilot-side snapshots
  routed by name from `.github/copilot-instructions.md`. They are not generated,
  so they silently lag `.codex/skills`; when you change a skill that has a
  `.github` twin, refresh it or state that the lag is deliberate. `speckit-*`
  there is vendor output of spec-kit, hashed in
  `.specify/integrations/copilot.manifest.json` — never hand-edit it.
- `.claude/agents/*.md` and `.claude/commands/*.md`: role prompts and command
  entry points. `.grok/agents` is generated, not an editing source.

## Prompt contract

Make goal/trigger, inputs, constraints/authority, output, validation, and a stable
reproduction recipe discoverable. Keep provider-neutral wording unless a provider
feature is essential.

For implementation/review/test prompts include platform and localization impact,
but reference inherited project rules instead of copying the full web/native/i18n
contract. QA/review prompts must request raw evidence and stay neutral.

## Metadata budget

- Frontmatter: only `name` and `description` (vendor OpenSpec exceptions remain).
- Description: capability + concrete triggers in at most 380 characters for
  project-owned skills and Claude agents. Avoid file inventories, workflow stages,
  validation details, and repeated safety policy; those belong in the body or
  canonical docs.
- `short_description`: 25–64 characters.
- `default_prompt`: start with `Use $<skill-name>` and keep one focused sentence.
- Remove TODO/FIXME/TBD, model-specific claims, and duplicated project policy.

## Media prompts

- Standard UI actions reuse project primitives/Feather, not generated raster icons.
- Published travel/article media remains real/licensed/local or photorealistic
  raster; quest/campaign art follows its canonical style skill.
- Prompt edit, asset generation, upload, and publication are separate authority
  stages. Never use internet images without explicit permission/licensing.
- Creative article/quest prose belongs to the relevant content skill and its
  confirmation gate.

## Workflow and checks

1. Inventory the affected family/metadata and its canonical owner.
2. Trace conflicts to the canonical rule: target environment, stage authority,
   review/testing separation, credential handling, and artifact ownership.
   A passing metadata audit does not establish semantic consistency.
3. Remove duplicated rules; retain concrete inputs, incident evidence, and
   task-specific overrides. Keep public skill/agent names unless all callers
   are migrated. Re-read as a fresh invocation without chat-history assumptions;
   never turn an old session's permission or account snapshot into standing authority.
4. Run:

```bash
npm run audit:prompts
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/<name>
```

Validate each changed skill (including compatibility copies). If the system
Python lacks PyYAML, use `uv run --with pyyaml python` for the same validator.
After agent changes, run `node .grok/scripts/sync-agents.mjs`. After changing the
audit scripts, also run their regression suite — project Jest does not collect it
(`jest.config.js` `testMatch` is `**/__tests__/**/*.test.ts(x)`), so run it directly:

```bash
node --test .codex/skills/metravel-prompt-maintainer/scripts/skill-catalog-validation.test.js
```

`audit:prompts` failing on a `.claude/skills` mirror is usually another session's
uncommitted edit, not your change: compare the two families at `HEAD` before
touching files you do not own.

Report inspected families, canonical sources changed, size/count delta when
optimization was requested, validation, and deliberately retained legacy text.
