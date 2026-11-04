#!/usr/bin/env node
/**
 * Generate thin Grok agent wrappers from `.claude/agents/*.md`.
 * Claude files remain the role contract; this only adapts spawn_subagent types.
 *
 *   node .grok/scripts/sync-agents.mjs [--check]
 */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import skillMirror from '../../scripts/lib/skillMirror.js';

const { applyMirrorPlan, parseMirrorArgs } = skillMirror;
const { check } = parseMirrorArgs(process.argv.slice(2));

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

const files = readdirSync(srcDir).filter((name) => name.endsWith('.md')).sort();
if (!files.length) {
  process.stderr.write(`no Claude agents in ${srcDir}\n`);
  process.exit(1);
}

const expected = new Map();
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

Apply AGENTS.md for project scope, backend authority, and secret handling.
Keep project policy in its canonical source.
`;

  const target = `${name}.md`;
  if (!/^[a-z0-9-]+$/.test(name) || expected.has(target)) {
    throw new Error(`Invalid or duplicate Grok role name "${name}" in ${file}`);
  }
  expected.set(target, body);
}

const destInfo = lstatSync(destDir, { throwIfNoEntry: false });
if (destInfo && !destInfo.isDirectory()) {
  throw new Error('Expected a directory at .grok/agents');
}

const actual = new Map();
const entries = destInfo ? readdirSync(destDir, { withFileTypes: true }) : [];
for (const entry of entries) {
  if (!/\.md$/i.test(entry.name)) continue;
  if (!entry.isFile()) {
    throw new Error(`Expected a regular file at .grok/agents/${entry.name}`);
  }
  actual.set(entry.name, readFileSync(path.join(destDir, entry.name), 'utf8'));
}
const writes = [...expected]
  .filter(([file, content]) => actual.get(file) !== content)
  .map(([file, content]) => ({ path: file, content }));
const unexpected = [...actual.keys()].filter((file) => !expected.has(file));

if (unexpected.length || (check && writes.length)) {
  for (const file of unexpected) console.error(`grok-agent-sync: unexpected .grok/agents/${file}`);
  for (const file of writes) console.error(`grok-agent-sync: missing or outdated .grok/agents/${file.path}`);
  process.exitCode = 1;
} else {
  if (!check) applyMirrorPlan(destDir, { writes, deletes: [] });
  console.log(`grok-agent-sync: ${check ? 'checked' : 'synced'} ${expected.size} Grok agents`);
}
