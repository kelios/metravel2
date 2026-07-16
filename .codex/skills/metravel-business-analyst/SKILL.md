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
Platforms: desktop web | mobile web | Android | shared | none
Locales: RU/BE/UK/PL/EN | selected locales | none
Acceptance criteria:
Non-goals:
Content/data assumptions:
Metrics:
Risks:
Open questions:
```

When the brief will become a FE/BE board task, also draft the mandatory task-board contract
from `docs/TASK_BOARD_MCP.md`:

```md
## Task Contract

Scope:
User-visible result:
Data/API contract:
Platform impact:
Localization impact:
Dependencies:
Fallback/mock policy:
Validation:
Done gate:
```

## Rules

- Do not write implementation code.
- Prefer measurable acceptance criteria over broad intent.
- Keep non-goals explicit so engineering does not overbuild.
- Define the same product outcome across desktop web, mobile web, and Android.
  Mobile-web and Android acceptance criteria are paired; list only technical
  platform differences that the product actually requires.
- State whether acceptance criteria apply to RU/BE/UK/PL/EN. Separate app-owned
  UI localization from API/editorial content that needs a backend locale contract.
- For FE/BE dependencies, name the required board ids or the concrete endpoint/field/event that must unblock the work.
- Flag external-link, authentication, media, SEO, moderation, or admin implications when present.
- If a requirement conflicts with project rules, call out the conflict and propose the closest compliant behavior.
