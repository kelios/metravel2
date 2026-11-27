## Context

See proposal.md. Existing local Qwen and FLUX work, but the custom image ACP agent deliberately lacks repository tools. Native Chat exposes large tool metadata and has not provided a reliable development loop. The board MCP itself does not enforce the Claude client hooks.

## Goals / Non-Goals

Goals: a mature ACP loop with local-only models; lazy canonical skills; board/knowledge/image tools; ported controls; measured code and translation capability.
Non-goals: a new coding-agent framework, model training, application changes, credential disclosure, or a demonstration deploy/delete/publication.

## Decisions

1. Pin OpenCode 1.19.6 and use its ACP, file/edit/shell/subagent mechanisms. A bespoke unrestricted shell extension of the image agent is rejected because it would recreate an agent framework.
2. Keep configuration under `.aiassistant/universal`, with an explicit local provider allowlist and model limits matching the actual server. Preserve normal project Git hooks and operation locks.
3. Reuse the existing task-board launcher without copying secrets. An OpenCode tool plugin maps MCP names and forwards canonical pre/post hook payloads. Denial JSON with exit zero is blocking; raw post-response ordering is preserved before compaction. Destructive MCP operations use explicit client confirmation.
4. Reuse FLUX MCP with an optional text-only result to avoid sending image inputs to a text-only model server. Images remain saved drafts.
5. Load AGENTS automatically and skills/prompts on demand. Native eager skill descriptions exceeded 32k in the first probe; use a bounded instruction-discovery MCP and Read instead of embedding all 110 descriptions, without removing access to any canonical skill. Generate adapters for role/command metadata only when required; canonical bodies remain single-source.
6. Evaluate a frozen real TODO translation as a local draft and judge meaning independently. Agent code/edit/test and MCP-read evidence are separate from model-only translation quality. No hidden production probe establishes deployment correctness.

## Risks / Trade-offs

- Local model context or planning failures → measure actual prompts, bounded tools and honest partial/failed results; do not disable checks to obtain a pass.
- Unenforced Claude-only hooks → invoke them at the actual tool boundary and test exit-zero denials on MCP paths.
- Shell can perform broad operations → retain normal client permissions and repository gates; do not claim a general security sandbox.
- 24 GB memory → one inference server, idle model unloading, serialized image generation.
- Staff board credentials → launcher loads existing local secret file; model-facing config contains no secret values.
- Real language errors → canonical validators plus independent source-grounded semantic review; a single case is not whole-model accuracy.

## Migration Plan

Install external runtime, validate config/guards, complete independent source review, register a distinct universal ACP mode and perform local acceptance. Preserve the working image-only mode until the new mode passes. Rollback removes the new named registration and configuration; no application deployment is required.

## Supervised real work — 2026-11-27

The owner requested useful board tasks, teacher correction and actual publication/push, plus comparison with other local models. Keep original product cards canonical; sprint 41 records this work. A teacher grades the original attempt separately from the accepted result and finishes useful drafts. The failed PL draft is repaired through the existing translation pipeline; it is not discarded or accepted by self-review.

Real code attempts exposed a context mechanism: roughly 21k tokens of static instructions/tools plus the default preserved tail can repeatedly trigger compaction. Set the supported `preserve_recent_tokens: 2048` and `tail_turns: 1`; `reserved` alone does not change the budget when model input is unset. A separate `student.py` copies the full profile, removes Task/delegation metadata and unused MCP tools for a bounded code/cover assignment, retains lazy canonical instruction lookup and board reads, and denies board writes. Main PhpStorm access remains available. Send assignment text through stdin, so process detection does not mistake a quoted Jest command for a running test.

Alternative backends are explicit loopback selections and fail without fallback if the teacher has not started the selected serialized server. Public model facts, actual inference measurements, tooling failures and task acceptance remain separate evidence. Neither a score nor model installation grants production authority.
