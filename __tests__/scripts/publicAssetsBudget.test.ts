/**
 * #1151: бюджет статики первого экрана.
 *
 * `favicon.ico` весил 62 056 B (внутрь были упакованы кадры 128×128 и 256×256) и
 * качался с приоритетом High на 2 245 мс — прямо в окне LCP, вместе с
 * `logo_yellow_192x192.png` (23 КБ), объявленным как `rel="icon"`. Суммарно 83 КБ
 * иконок конкурировали с hero и первым JS (замер прода 2026-07-30).
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

const sizeOf = (relPath: string): number =>
  fs.statSync(path.join(REPO_ROOT, relPath)).size;

describe('бюджет иконок в public/', () => {
  it('favicon.ico не содержит крупных кадров и укладывается в 15 КБ', () => {
    const file = path.join(REPO_ROOT, 'public', 'favicon.ico');
    const data: Buffer = fs.readFileSync(file);

    expect(data.readUInt16LE(0)).toBe(0); // reserved
    expect(data.readUInt16LE(2)).toBe(1); // type: icon
    const count = data.readUInt16LE(4);
    expect(count).toBeGreaterThan(0);

    const widths: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const entry = 6 + i * 16;
      widths.push(data.readUInt8(entry) || 256);
    }
    // 128/256 в фавиконке не нужны: вкладка рисует 16–32, а установочные иконки
    // объявлены в manifest.json.
    expect(Math.max(...widths)).toBeLessThanOrEqual(64);
    expect(data.length).toBeLessThanOrEqual(15_000);
  });

  it('apple-touch-icon остаётся в разумных пределах', () => {
    expect(sizeOf('public/apple-touch-icon.png')).toBeLessThanOrEqual(25_000);
  });
});

describe('иконки в <head>', () => {
  const html: string = fs.readFileSync(path.join(REPO_ROOT, 'app', '+html.tsx'), 'utf-8');

  it('PWA-иконки 192/512 не объявлены как rel="icon"', () => {
    const iconLinks = html.match(/<link\b[^>]*rel="icon"[^>]*>/g) ?? [];
    expect(iconLinks.length).toBeGreaterThan(0);
    for (const link of iconLinks) {
      expect(link).not.toContain('logo_yellow_192x192');
      expect(link).not.toContain('logo_yellow_512x512');
    }
  });

  it('но остаются доступны для установки через manifest.json', () => {
    expect(html).toContain('rel="manifest"');
    const manifest = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'public', 'manifest.json'), 'utf-8'),
    );
    const sizes = (manifest.icons || []).map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});
