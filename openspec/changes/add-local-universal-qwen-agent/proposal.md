## Why

The installed local PhpStorm agent can generate images but cannot inspect or edit MeTravel, execute checks, or follow board workflows. The owner needs one local agent and evidence of what the model can actually do, especially on real translation tasks.

## What Changes

- Add a pinned mature ACP development runtime using only the existing loopback Qwen endpoint.
- Reuse canonical project instructions, skills, role/command prompts, knowledge search and the board MCP launcher.
- Bridge the existing board quality, claim and review hooks; preserve destructive-action confirmation and repository Git/deploy gates.
- Add the existing local FLUX tool to the same agent with a text-only MCP result appropriate for the text inference server.
- Evaluate code repair/check execution, board reading, draft translation quality and image generation; report measured limits rather than a claim of perfect autonomy.

## Capabilities

### New Capabilities

- `local-universal-agent`: local workstation agent with repository tools and protected workflow integrations, with evidence-backed capability reporting.

### Modified Capabilities

None. Application and public API contracts are unchanged.

## Impact

Task-owned paths: `.aiassistant/universal/**`, a bounded FLUX MCP response option and this OpenSpec change; local IDE agent registration and external pinned CLI installation. Existing staged image setup is preserved.

Platform impact: none — developer workstation only. Localization impact: none in app; RU and selected editorial target locales are evaluated on local copies.

User-visible impact: PhpStorm agent behavior. Security: local provider isolation, secret handling and actual hook enforcement. Performance: context/memory budget on a 24 GB Mac. Public API, application SEO, accessibility and analytics: not applicable, no app runtime changes.

Dependencies: installed Qwen/llama.cpp, local MFLUX, Node 22, existing board credentials and canonical hooks. No backend source changes. Fallback/mock policy: mocks may prove guard contracts, never translation meaning, actual execution or deployment. No production deploy, task deletion or content publication merely to demonstrate a capability.
