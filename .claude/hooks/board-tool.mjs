// Claude preserves the MCP server's hyphens. Codex can expose the same server with underscores.
export function boardToolName(name) {
  if (typeof name !== 'string') return null;
  return /^(?:mcp__metravel-task-board__|mcp__metravel_task_board__)(metravel_\w+)$/.exec(name)?.[1] ?? null;
}

export function isBoardError(value) {
  return Boolean(value && (value.isError === true || value.is_error === true || value.status === 'error' || value.error));
}

export function decodeBoardResponse(response) {
  if (response == null) return null;
  if (typeof response === 'string') {
    try {
      return decodeBoardResponse(JSON.parse(response));
    } catch {
      return null;
    }
  }
  if (Array.isArray(response)) {
    if (response.length > 0 && response.every(isContentBlock)) return parseBlocks(response);
    return response;
  }
  if (typeof response === 'object') {
    if (isBoardError(response)) return response;
    if (response.structuredContent != null) return decodeBoardResponse(response.structuredContent);
    if (Array.isArray(response.content) && response.content.every(isContentBlock)) {
      return parseBlocks(response.content);
    }
    return response;
  }
  return null;
}

function isContentBlock(block) {
  return block && typeof block === 'object' && typeof block.type === 'string' && 'text' in block;
}

function parseBlocks(blocks) {
  const text = blocks.map((block) => (typeof block.text === 'string' ? block.text : '')).join('');
  try {
    return decodeBoardResponse(JSON.parse(text));
  } catch {
    return null;
  }
}
