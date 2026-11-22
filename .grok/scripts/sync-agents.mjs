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
import catalog from '../../.codex/skills/metravel-prompt-maintainer/scripts/skill-catalog-validation.js';
import skillMirror from '../../scripts/lib/skillMirror.js';

const { applyMirrorPlan, parseMirrorArgs } = skillMirror;
const { check } = parseMirrorArgs(process.argv.slice(2));

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(repoRoot, '.claude', 'agents');
const destDir = path.join(repoRoot, '.grok', 'agents');

const { files, errors } = catalog.catalogFiles(srcDir, '.md');
if (errors.length) throw new Error(errors.map(({ file, message }) => `${file}: ${message}`).join('\n'));
files.sort();
if (!files.length) {
  process.stderr.write(`no Claude agents in ${srcDir}\n`);
  process.exit(1);
}

const expected = new Map();
for (const file of files) {
  const source = readFileSync(path.join(srcDir, file), 'utf8');
  const { name, description, errors } = catalog.claudeAgentMetadata(source, path.basename(file, '.md'));
  if (errors.length) throw new Error(`.claude/agents/${file}: ${errors.join(', ')}`);

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
