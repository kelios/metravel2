# Local FLUX in PhpStorm

Local workstation integration. Uses the existing Qwen endpoint and installed
FLUX.2-klein-4B Q4 weights; no cloud inference or publication.

- AI Chat mode for image requests: **Qwen + FLUX (local)** (custom ACP agent).
  The regular **Chat / metravel-local** remains available for other tasks.
- Qwen local endpoint / existing OpenAI-compatible provider: `http://127.0.0.1:18088/v1`, Tool calling enabled.
- Server and IDE context: **32768** (the native context collector advertises
  roughly 25k tokens of tool descriptions).
- Project MCP configuration: `.ai/mcp/mcp.json`; server **local-flux**.
- Tool: **generate_flux_image**, defaults 768×768, one image per call.

Example request:

> Сгенерируй картинку рыжей собаки на лесной тропинке, утренний свет,
> фотореализм, без надписей, 512×512. Подготовь промпт и запусти FLUX.

The ACP agent asks the same local Qwen to compose the prompt and choose the
reviewed tool. It avoids native Chat context collection and its large tool list.
The tool runs fixed local MFLUX with offline flags.
It returns image/png and a saved path. Files and the exact prompt are retained
under `.codex-temp/flux-images/<job>/`. Images are drafts; nothing is uploaded.
If the IDE requests approval for this tool, approve that image-generation call.
The user request authorizes generating a draft, not live-site changes.

Local runtime dependencies are intentionally outside the app environment:

- MCP interpreter: `/Users/juliasavran/metravel-ai/tools/flux-mcp-venv/bin/python`;
  pinned SDK in `requirements.txt`.
- Image executable/model: existing MFLUX installation under
  `/Users/juliasavran/metravel-ai/` (see fixed paths in `server.py`).
- Qwen launcher:
  `/Users/juliasavran/Documents/Codex/2026-11-26/new-chat/outputs/qwen-metravel/Start-Qwen.command`.

Custom agent registration: `~/.jetbrains/acp.json`; template `phpstorm-acp.json`.
This agent receives no IDE or extra MCP tools and does not modify project code.
Remove its named entry to disable the ACP mode.

To disable the separate MCP entry: Settings → Tools → AI Assistant → Model Context Protocol (MCP),
disable local-flux. The project rule `.aiassistant/rules/metravel.md` routes image
requests to the tool when available. Both integrations start their helper on demand; Qwen's model server
must also be running. Do not start concurrent copies of either model server.

The tool bounds dimensions, uses no shell, serializes rendering with a file lock,
and terminates the process group on cancellation or a 180-second timeout.

Validation evidence: `.codex-temp/flux-integration/` (ignored local diagnostics).
Source review and protocol tests do not replace a successful native chat render.

Observed native Chat limitation: the context collector issued multiple large
requests; the normal image request did not complete a tool call. Direct local
Qwen tool selection plus MCP rendered a correct 512×512 PNG (33.6s Qwen +18.3s
FLUX). The ACP mode uses this minimal request pattern. Native ACP QA passed: a Russian chat request generated the PNG, and the
**Открыть PNG** link opened it in PhpStorm's image editor. This IDE build displays
a link rather than an inline ACP image preview.

## Memory on this 24 GB workstation

The Qwen launcher now uses `--sleep-idle-seconds 1` and disables the separate RAM
prompt cache. When idle, llama-server unloads model/KV memory; the next request
automatically wakes it. This gives FLUX memory after Qwen has composed the prompt.
Cold wake adds model-loading time. Keep only one Qwen server running.
Native first render during IDE indexing took 111.8s; the isolated direct check
took 18.3s. Recheck latency after any model, context, IDE-memory or indexing change.

During restart, a queued incompatible AI Assistant update was applied. Restored
official compatible version 261.25134.239 for IDE build 261.25134.104. The previous
plugin is backed up in ignored `.codex-temp/flux-integration/`. NoIDEupgrade or
MeTravel application deployment was performed.

Final repeat QA after routing repair and automatic memory release passed:
Qwen woke automatically, selected the required tool for an explicit image request,
FLUX rendered a new 512×512 PNG in 4.7s, and OpenPNG opened the new file in the IDE.
The repaired request routing passed 13 focused tests including 14 HTTP payload cases.
