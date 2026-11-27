#!/usr/bin/env python3
"""Generate thin OpenCode role/command metadata from canonical MeTravel sources.

Run with Python 3; Node 22 is used for the project's existing safe metadata
parser. No YAML execution, model calls, role bodies or original model/tool
frontmatter are copied. --check detects stale metadata without writing it.
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).resolve().with_name('metadata.json')
NODE = '/opt/homebrew/opt/node@22/bin/node'
MODEL = 'local-qwen/metravel-local'

# Reuse the same bounded frontmatter reader and validator as the Grok adapter.
# Command descriptions use that reader with a synthetic name in memory only;
# command names remain their canonical filenames. Never alter canonical files.
EXTRACT = r'''
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('./.codex/skills/metravel-prompt-maintainer/scripts/skill-catalog-validation.js');
const result = {};
for (const family of ['agents', 'commands']) {
  const directory = path.join('.claude', family);
  const { files, errors } = catalog.catalogFiles(directory, '.md');
  if (errors.length || !files.length) throw new Error(`Invalid or empty canonical ${family} directory`);
  result[family] = files.sort().map(file => {
    const name = path.basename(file, '.md');
    let source = fs.readFileSync(path.join(directory, file), 'utf8');
    if (family === 'commands') {
      const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
      if (!fm) throw new Error(`${directory}/${file}: missing frontmatter`);
      if (!/^name:/m.test(fm)) source = source.replace(/^---\r?\n/, `---\nname: ${name}\n`);
    }
    const metadata = catalog.claudeAgentMetadata(source, name);
    if (metadata.errors.length) throw new Error(`${directory}/${file}: ${metadata.errors.join(', ')}`);
    return { name: metadata.name, description: metadata.description, file: `${directory}/${file}` };
  });
}
process.stdout.write(JSON.stringify(result));
'''


def build_metadata():
    process = subprocess.run([NODE, '-e', EXTRACT], cwd=ROOT,
                             text=True, capture_output=True, check=True)
    sources = json.loads(process.stdout)
    roles = {}
    commands = {}
    for item in sources['agents']:
        name = item['name']
        if name in roles:
            raise ValueError('Duplicate canonical role: ' + name)
        roles[name] = {
            'mode': 'subagent',
            'model': MODEL,
            'description': item['description'],
            'prompt': (
                f"Read the full canonical role contract `{item['file']}` and follow it. "
                'Follow inherited AGENTS.md; platform and localization impact are task-specific. '
                'Keep the current local model and use only tools actually available in this runtime; '
                'the source frontmatter model/tools fields describe its original runtime. '
                'Reading a role does not grant additional authority.'
            ),
        }
    for item in sources['commands']:
        name = item['name']
        if name in commands:
            raise ValueError('Duplicate canonical command: ' + name)
        commands[name] = {
            'description': item['description'],
            'template': (
                f"Read and execute the canonical command `{item['file']}`. "
                'Follow its referenced instructions and inherited AGENTS.md. '
                'Use only available tools and the current local model; preserve the current '
                'user scope and applicable operation gates. '
                'Substitute the following task arguments for the canonical command arguments:\n'
                '$ARGUMENTS'
            ),
        }
    return {'agent': roles, 'command': commands}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        metadata = build_metadata()
        text = json.dumps(metadata, ensure_ascii=False, indent=2) + '\n'
        if args.check:
            if not OUTPUT.is_file() or OUTPUT.read_text() != text:
                parser.exit(1, 'OpenCode metadata is missing or stale; run sync_metadata.py.\n')
        else:
            # ACP sessions may refresh concurrently; readers must see a complete JSON file.
            with tempfile.NamedTemporaryFile('w', dir=OUTPUT.parent, prefix='.metadata-',
                                             suffix='.tmp', delete=False, encoding='utf-8') as temp:
                temp.write(text)
                temporary = Path(temp.name)
            try:
                temporary.replace(OUTPUT)
            finally:
                temporary.unlink(missing_ok=True)
    except subprocess.CalledProcessError as exc:
        # Only this extractor's metadata validation diagnostics are captured.
        parser.exit(1, 'Canonical metadata validation failed:\n' + exc.stderr)
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(1, f'Cannot generate OpenCode metadata: {exc}\n')
    print(f"{'Checked' if args.check else 'Generated'} {len(metadata['agent'])} roles and "
          f"{len(metadata['command'])} commands; model={MODEL}; output={OUTPUT}")


if __name__ == '__main__':
    main()
