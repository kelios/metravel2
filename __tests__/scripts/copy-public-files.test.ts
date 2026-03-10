import fs from 'fs';
import path from 'path';

describe('copy-public-files', () => {
  it('keeps travel hero preload script in the production copy allowlist', () => {
    const filePath = path.resolve(process.cwd(), 'scripts/copy-public-files.js');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain("'travel-hero-preload.js'");
  });
});
