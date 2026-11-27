/* global require, process, __dirname */
const fs = require('node:fs');
const path = require('node:path');

const config = fs.realpathSync(process.argv[2]);
const output = path.dirname(config);
const root = path.resolve(__dirname, '../..');
const allowed = fs.realpathSync(path.join(root, '.codex-temp/local-web-qa'));
if (path.basename(config) !== 'browser.json' || !output.startsWith(allowed + path.sep)) {
  throw new Error('Browser MCP config must belong to one ignored QA batch.');
}
const tool = path.join(require('node:os').homedir(), 'metravel-ai/tools/playwright-mcp/node_modules/@playwright/mcp');
if (JSON.parse(fs.readFileSync(path.join(tool, 'package.json'), 'utf8')).version !== '0.0.86') {
  throw new Error('The reviewed Playwright MCP 0.0.86 is required; do not silently update the runtime.');
}
// Browser-named files cannot overwrite the supervisor's configs, raw events or receipt.
const workspace = path.join(output, 'browser');
const settings = JSON.parse(fs.readFileSync(config, 'utf8'));
if (settings.outputDir !== workspace || fs.realpathSync(workspace) !== workspace) {
  throw new Error('Browser artifacts must stay in their dedicated batch workspace.');
}
process.chdir(workspace);
const cli = path.join(tool, 'cli.js');
process.argv = [process.execPath, cli, '--config', config, '--ignore-roots', '--codegen', 'none', '--file-paths', 'absolute'];
require(cli);
