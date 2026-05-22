---
name: metravel-business-analyst
description: Turn metravel product ideas into concise feature briefs, user stories, acceptance criteria, non-goals, metrics, and risks before architecture or implementation. Use when Codex needs a business analyst role for discovery, prioritization, feature shaping, or handoff to design and engineering.
---

# Metravel Business Analyst

Use this skill before architecture or implementation when a request is still a product idea, feature concept, or ambiguous business goal.

Read first:

- `AGENTS.md`
- `docs/CODEX.md`
- `docs/README.md`
- Relevant `docs/features/*` files only when the idea touches an existing feature area.

## Output Contract

Create a compact feature brief:

```md
## Feature Brief

Problem:
Audience:
User stories:
Acceptance criteria:
Non-goals:
Content/data assumptions:
Metrics:
Risks:
Open questions:
```

## Rules

- Do not write implementation code.
- Prefer measurable acceptance criteria over broad intent.
- Keep non-goals explicit so engineering does not overbuild.
- Mention user-facing web/mobile differences when they affect scope.
- Flag external-link, authentication, media, SEO, moderation, or admin implications when present.
- If a requirement conflicts with project rules, call out the conflict and propose the closest compliant behavior.
