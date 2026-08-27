#!/usr/bin/env node
/**
 * Generate thin Grok agent wrappers from `.claude/agents/*.md`.
 * Claude files remain the role contract; this only adapts spawn_subagent types.
 *
 *   node .grok/scripts/sync-agents.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(repoRoot, '.claude', 'agents');
const destDir = path.join(repoRoot, '.grok', 'agents');

const yamlScalar = (frontmatter, key) => {
  const lines = frontmatter.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index < 0) return '';
  const inline = lines[index].slice(key.length + 1).trim();
  if (/^[>|][+-]?$/.test(inline)) {
    const folded = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!/^\s+/.test(line)) break;
      if (line.trim()) folded.push(line.trim());
    }
    return folded.join(' ');
  }
  const quoted = inline.match(/^(["'])([\s\S]*)\1$/);
  return quoted ? quoted[2] : inline;
};

const parseFrontmatter = (text) => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
};

mkdirSync(destDir, { recursive: true });

const files = readdirSync(srcDir).filter((name) => name.endsWith('.md')).sort();
if (!files.length) {
  process.stderr.write(`no Claude agents in ${srcDir}\n`);
  process.exit(1);
}

for (const file of files) {
  const source = readFileSync(path.join(srcDir, file), 'utf8');
  const fm = parseFrontmatter(source);
  const name = yamlScalar(fm, 'name') || file.replace(/\.md$/, '');
  const description =
    yamlScalar(fm, 'description') ||
    `MeTravel ${name} agent. Load .claude/agents/${file} and follow it.`;

  const body = `---
name: ${name}
description: ${JSON.stringify(description)}
prompt_mode: full
agents_md: true
---

Load \`.claude/agents/${file}\` with \`read_file\` and follow it as the full
role contract. Grok tool/MCP mapping is in \`.grok/rules/00-grok.md\`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; \`../metravel-backend\` is read-only. Do not print secrets.
`;

  writeFileSync(path.join(destDir, `${name}.md`), body, 'utf8');
}

process.stdout.write(`synced ${files.length} Grok agents from .claude/agents → .grok/agents\n`);
