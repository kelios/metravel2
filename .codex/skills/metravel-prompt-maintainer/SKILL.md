---
name: metravel-prompt-maintainer
description: Audit, create, and update metravel prompt artifacts and skill UI prompts. Use for docs/*PROMPTS.md, assets/**/PROMPT.md, .codex/skills/*/agents/openai.yaml, prompt-template consistency, stale model-specific instructions, reproducibility metadata, or project-wide prompt/skill audits. Do not use for writing article or quest prose itself.
---

# Metravel Prompt Maintainer

Keep reusable prompts concise, reproducible, project-owned, and aligned with current repository rules.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- `$metravel-docs-maintainer` when canonical documentation or skill routing also changes.

## Artifact map

- `docs/*PROMPTS.md`: canonical prompt specs shared by a family of generated assets.
- `assets/**/PROMPT.md`: concrete, reproducible prompt instances stored beside tracked assets.
- `.codex/skills/*/SKILL.md`: operational behavior and non-obvious project constraints.
- `.codex/skills/*/agents/openai.yaml`: short UI metadata and a one-sentence invocation prompt, not a second copy of the skill.

Keep each rule in one canonical location. Derived prompt instances should link to the canonical spec and contain only the concrete subject, overrides, output slot, and exact generation prompt needed to reproduce the asset.

## Prompt contract

Every maintained prompt must make these items discoverable:

1. Goal and trigger: what the prompt produces and when it applies.
2. Inputs: concrete values or named placeholders with no hidden assumptions.
3. Constraints: current project rules, authority boundaries, prohibited content, and secret hygiene.
4. Output: format, dimensions/schema, destination, and whether publication/upload is separately authorized.
5. Validation: how to check factual, visual, structural, or runtime correctness.
6. Reproducibility: canonical spec link plus the exact final prompt or stable assembly recipe.

For implementation, architecture, review, QA, or test prompts, also require an
explicit `Platform impact` for web/Android/iOS and `Localization impact` for
RU/BE/UK/PL/EN, or an explicit `none`. Do not let a reusable prompt assume that
shared Expo/React Native code is web-only or that app-owned UI copy is single-language.

Prefer provider-neutral wording unless a provider-specific feature is essential. Remove references such as “Claude-proven” or `CLAUDE.md` when the rule is actually project-owned; point to `AGENTS.md` or the canonical file in `docs/` instead.

## Skill metadata rules

- Keep frontmatter limited to `name` and `description`.
- Make `description` state both capability and concrete trigger surfaces.
- Keep `agents/openai.yaml` strings quoted.
- Keep `short_description` at 25–64 characters.
- Start `default_prompt` with `Use $<skill-name>` and keep it to one focused sentence.
- Put durable workflow detail in `SKILL.md`; do not duplicate it in `default_prompt`.
- Remove scaffolding markers such as `TODO`, `FIXME`, `TBD`, and template guidance before handoff.

## Media prompt rules

- Standard production UI actions use existing primitives and Feather icons; do not generate raster icons as a default substitute.
- Published travel/article media must be real licensed/local photos or photorealistic generated raster images. Do not route illustration, SVG, screenshots, or placeholder art into those slots.
- Quest covers and campaign art may use the explicit style allowed by the relevant canonical prompt spec.
- Route raster generation, post-processing, and app integration to `$metravel-visual-asset-designer`; this skill owns the prompt contract and audit layer. For children's, family, fairy-tale, park, or teen quest covers, also use `$metravel-child-quest-visuals`; it owns the age mode and illustrated story contract.
- Never use an internet image without explicit permission and verified licensing.
- Keep generated text, letters, logos, and watermarks out of image prompts unless the user explicitly requests them and the destination supports them.
- Treat prompt editing, asset generation, upload, and publication as separate actions. A prompt change does not authorize a production write.
- Creative article or quest prose remains gated by the separate confirmation rule in `AGENTS.md`; route authored quest content to `$metravel-quest-writer` and article text to `$metravel-article-editor-agent`.

## Workflow

1. Inventory the affected prompt families and their canonical source.
2. Identify duplicated rules, stale paths/model names, missing authority gates, and non-reproducible outputs.
3. Choose one canonical rule location and shorten derived prompts to references plus concrete overrides.
4. Update the matching skill routing and `agents/openai.yaml` only when triggering behavior changes.
5. Run the project prompt audit and the skill-creator validator for every changed skill.
6. Re-read the final prompt as a fresh invocation: it must be sufficient without relying on chat history.

Run:

```bash
npm run audit:prompts
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/<skill-name>
```

If the validator path differs, locate the installed `skill-creator` and use its `quick_validate.py`.

## Handoff

Return a compact `Prompt Audit` with the prompt families inspected, canonical sources changed, validation results, and any deliberately retained legacy reference.
