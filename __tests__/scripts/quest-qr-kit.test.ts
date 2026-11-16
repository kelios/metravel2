const path = require('node:path');
const fs = require('node:fs');
const {runNodeCli, makeTempDir} = require('./cli-test-utils');
const script = path.join(__dirname, '../../scripts/quests/build-qr-kit.mjs');

describe('quest QR kit CLI argument contract', () => {
  const temporary = makeTempDir('qr-cli-', {root: path.join(__dirname, '../../.codex-temp/task-3248/cli-tests')});
  afterAll(() => fs.rmSync(temporary, {recursive: true, force: true}));
  it('describes the single-command inputs without source requests or rendering', () => {
    const result = runNodeCli([script, '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--quest-id ID --campaign PLACEMENT');
    expect(result.stdout).toContain('--locale ru|be|uk|pl|en');
  });

  it.each([
    [], ['--quest-id', '../private', '--campaign', 'venue'],
    ['--quest-id', 'krakow-dragon'],
    ['--quest-id', 'krakow-dragon', '--campaign', 'venue', '--api-origin', 'https://example.com'],
    ['--quest-id', 'krakow-dragon', '--campaign', 'venue', '--campaign', 'other'],
    ['--quest-id', 'krakow-dragon', '--campaign', 'venue', 'toString', 'value'],
  ].map(args => [args]))('rejects invalid invocation %j before reading sources', (args: string[]) => {
    const result = runNodeCli([script, ...args]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/quest-qr-kit:/);
    expect(result.stderr).not.toContain('Published quest source');
  });

  it('preserves occupied destinations and dangling links before reading sources', () => {
    const directory = path.join(temporary, 'existing');
    const file = path.join(temporary, 'file');
    const link = path.join(temporary, 'link');
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'keep.txt'), 'existing kit');
    fs.writeFileSync(file, 'existing file');
    fs.symlinkSync('missing-kit', link);
    for (const output of [directory, file, link]) {
      const result = runNodeCli([script, '--quest-id', 'krakow-dragon', '--campaign', 'venue', '--output', output]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Output already exists');
      expect(result.stderr).not.toContain('Published quest source');
    }
    expect(fs.readFileSync(path.join(directory, 'keep.txt'), 'utf8')).toBe('existing kit');
    expect(fs.readFileSync(file, 'utf8')).toBe('existing file');
    expect(fs.readlinkSync(link)).toBe('missing-kit');
    expect(fs.existsSync(path.join(temporary, 'missing-kit'))).toBe(false);
  });
});
