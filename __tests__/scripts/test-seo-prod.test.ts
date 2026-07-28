import fs from 'fs';
import path from 'path';

const { isBlockedFromIndexing } = require('../../scripts/test-seo-prod');

const ROOT = path.resolve(__dirname, '../..');

// Regression guard for #1107: the production gate must fire on a real
// deindexing risk (#1090 served every article as a noindex shell for a day)
// and stay quiet on directives that do not block indexing — otherwise it is
// permanently red and nobody reacts to it.
describe('production SEO gate: indexability check (#1107)', () => {
  it('treats a page without robots meta as indexable', () => {
    expect(isBlockedFromIndexing('')).toBe(false);
    expect(isBlockedFromIndexing(undefined)).toBe(false);
  });

  it('accepts preview directives that do not block indexing', () => {
    expect(isBlockedFromIndexing('max-image-preview:large')).toBe(false);
    expect(isBlockedFromIndexing('max-snippet:-1, max-image-preview:large')).toBe(false);
    expect(isBlockedFromIndexing('index, follow')).toBe(false);
  });

  it('fires on the directives that actually remove a page from the index', () => {
    expect(isBlockedFromIndexing('noindex')).toBe(true);
    expect(isBlockedFromIndexing('noindex, follow')).toBe(true);
    expect(isBlockedFromIndexing('NOINDEX, NOFOLLOW')).toBe(true);
    expect(isBlockedFromIndexing('none')).toBe(true);
    expect(isBlockedFromIndexing('max-image-preview:large, noindex')).toBe(true);
  });

  it('does not confuse nofollow with a blocked page', () => {
    // nofollow affects link equity, not whether the page is indexed.
    expect(isBlockedFromIndexing('nofollow')).toBe(false);
  });

  it('wires the gate into the daily SEO routine as a blocking first step', () => {
    const agent = fs.readFileSync(path.join(ROOT, '.claude/agents/seo-daily.md'), 'utf8');
    expect(agent).toMatch(/npm run test:seo:prod/);
    expect(agent).toMatch(/Шаг 0/);
    // The routine must not submit URLs for indexing while output is broken.
    expect(agent).toMatch(/останавливается/);
  });
});
