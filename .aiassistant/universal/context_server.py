"""Lazy canonical instruction discovery; metadata only, one bounded MCP tool."""
import json
from pathlib import Path
import re
import subprocess
from typing import Literal

from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).resolve().parents[2]
NODE = '/opt/homebrew/opt/node@22/bin/node'
SERVER = FastMCP('MeTravel instruction discovery')
KINDS = ('skills', 'roles', 'commands', 'all')

# Reuse canonical safe metadata readers, without parsing YAML as executable data.
# Read from current source files on each request; do not persist an index/mirror.
EXTRACT = r'''
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('./.codex/skills/metravel-prompt-maintainer/scripts/skill-catalog-validation.js');
const root = fs.realpathSync('.');
const rows = [];
function add(file, kind, name) {
  const absolute = fs.realpathSync(file);
  if (!absolute.startsWith(root + path.sep)) throw new Error('Instruction path escapes project');
  let source = fs.readFileSync(absolute, 'utf8');
  if (kind === 'commands' && !/^name:/m.test(source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || '')) {
    if (!/^---\r?\n/.test(source)) throw new Error(`${file}: missing frontmatter`);
    source = source.replace(/^---\r?\n/, `---\nname: ${name}\n`);
  }
  const meta = catalog.claudeAgentMetadata(source, name);
  const errors = kind === 'skills' ? catalog.skillMetadataErrors(source, name, false) : meta.errors;
  if (errors.length) throw new Error(`${file}: ${errors.join(', ')}`);
  if (!meta.name || !meta.description) throw new Error(`${file}: missing metadata`);
  rows.push({kind, name:meta.name, description:meta.description, path:absolute});
}
for (const dir of ['.codex/skills', '.claude/skills']) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (item.isDirectory()) add(path.join(dir,item.name,'SKILL.md'),'skills',item.name);
  }
}
for (const [dir,kind] of [['.claude/agents','roles'],['.claude/commands','commands']]) {
  const {files,errors} = catalog.catalogFiles(dir,'.md');
  if (errors.length || !files.length) throw new Error(`Invalid canonical ${kind} directory`);
  for (const file of files.sort()) add(path.join(dir,file),kind,path.basename(file,'.md'));
}
process.stdout.write(JSON.stringify(rows));
'''


def load_catalog():
    try:
        process = subprocess.run([NODE, '-e', EXTRACT], cwd=ROOT, text=True,
                                 capture_output=True, check=True, timeout=15)
        return json.loads(process.stdout)
    except (OSError, subprocess.SubprocessError, ValueError):
        raise RuntimeError('Canonical instruction metadata is unavailable; check project metadata validation.') from None


def words(text):
    return set(re.findall(r'[^\W_]+', text.casefold(), re.UNICODE))


def rank(query, item):
    folded = query.casefold().strip().lstrip('$')
    name = item['name'].casefold()
    if folded == name:
        return 100000
    tokens = words(folded)
    name_words = words(name)
    description_words = words(item['description'])
    score = 10000 if name in folded else 0
    for token in tokens:
        if token in name_words:
            score += 30
        elif len(token) >= 3 and any(word.startswith(token) for word in name_words):
            score += 12
        if token in description_words:
            score += 5
        elif len(token) >= 3 and any(word.startswith(token) for word in description_words):
            score += 2
    return score


@SERVER.tool()
def find_project_instructions(query: str, kind: Literal['skills', 'roles', 'commands', 'all'] = 'all', limit: int = 8):
    """Find current MeTravel skills, roles or command prompts by name/Russian/English
    keywords. Returns only names, descriptions and canonical paths; read the chosen
    file with the client's normal Read tool. Empty query returns category counts and
    routing paths. Never loads full instruction bodies into model context.
    """
    if not isinstance(query, str) or len(query) > 512:
        raise ValueError('Query must be text up to 512 characters.')
    if kind not in KINDS:
        raise ValueError('Kind must be skills, roles, commands or all.')
    if type(limit) is not int or not 1 <= limit <= 12:
        raise ValueError('Limit must be an integer from 1 to 12.')
    catalog = load_catalog()
    counts = {category: sum(item['kind'] == category for item in catalog) for category in KINDS[:-1]}
    result = {'query': query, 'kind': kind, 'counts': counts, 'matches': [],
              'routing_paths': [str(ROOT/'AGENTS.md'), str(ROOT/'docs/CODEX.md')],
              'next_step': 'Read only the selected canonical instruction file and the sections it requires.'}
    if not query.strip():
        return result
    candidates = [(rank(query, item), item) for item in catalog if kind == 'all' or item['kind'] == kind]
    matches = sorted(((score, item) for score, item in candidates if score > 0),
                     key=lambda row: (-row[0], row[1]['kind'], row[1]['name'], row[1]['path']))
    result['matching_count'] = len(matches)
    result['matches'] = [item for _, item in matches[:limit]]
    return result


if __name__ == '__main__':
    SERVER.run(transport='stdio')
