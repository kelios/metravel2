import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('copy-public-files', () => {
  it('keeps travel hero preload script in the production copy allowlist', () => {
    const filePath = path.resolve(process.cwd(), 'scripts/copy-public-files.js');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain("'travel-hero-preload-v2.js'");
  });

  it('copies the canonical quest cover into the deploy artifact unchanged', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/copy-public-files.js');
    const sourcePath = path.resolve(
      process.cwd(),
      'public/static/quests/quest-default-cover.svg',
    );
    const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-public-copy-'));

    try {
      execFileSync(process.execPath, [scriptPath, buildDir], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      const source = fs.readFileSync(sourcePath);
      const deployed = fs.readFileSync(
        path.join(buildDir, 'static/quests/quest-default-cover.svg'),
      );

      expect(deployed).toEqual(source);
      expect(createHash('sha256').update(source).digest('hex')).toBe(
        '41d0a0bdf5bed99aac43637f2e6ca20de65c565d00d846ce8f02af4abafc309d',
      );
    } finally {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  });
});
