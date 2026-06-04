import fs from 'fs';
import path from 'path';

describe('mobile scroll CSS contracts', () => {
  it('does not force every travel card to pan-y on coarse pointers', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8');
    const coarsePointerBlock = css.match(/@media \(pointer: coarse\) \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(coarsePointerBlock).not.toMatch(/^\s*\[data-testid\*="travel-card"\]\s*\{/m);
    expect(coarsePointerBlock).toContain('[data-testid="home-hero"] [data-testid*="travel-card"]');
  });
});
