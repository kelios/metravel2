import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils';

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
    const buildDir = makeTempDir('metravel-public-copy-');

    try {
      const result = runNodeCli([scriptPath, buildDir]);
      expect(result.status).toBe(0);

      const source = fs.readFileSync(sourcePath);
      const deployed = fs.readFileSync(
        path.join(buildDir, 'static/quests/quest-default-cover.svg'),
      );

      expect(deployed).toEqual(source);
      expect(createHash('sha256').update(source).digest('hex')).toBe(
        '41d0a0bdf5bed99aac43637f2e6ca20de65c565d00d846ce8f02af4abafc309d',
      );
    } finally {
      removeDir(buildDir);
    }
  });

  it('publishes the quest cover from the deploy artifact at the shared static URL', () => {
    const scriptPath = path.resolve(process.cwd(), 'build-prod.sh');
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain(
      'quest_cover_source=dist/$ENV/static/quests/quest-default-cover.svg',
    );
    expect(source).toContain(
      'quest_cover_target=static/quests/quest-default-cover.svg',
    );
    expect(source).toContain(
      'git ls-files --error-unmatch -- "\\$quest_cover_repo_path"',
    );
    expect(source).toContain(
      'mv -f "\\$quest_cover_tmp" "\\$quest_cover_target"',
    );
    expect(source).toContain(
      'cmp -s "\\$quest_cover_source" "\\$quest_cover_target"',
    );

    expect(source.indexOf('quest_cover_source=')).toBeLessThan(
      source.indexOf('mv dist/$ENV static/dist.new'),
    );
  });
});
