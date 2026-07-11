import {
  groupConsecutiveImages,
  removeImageLayoutClasses,
  applySmartImageLayout,
} from '@/utils/richTextImageLayout';

describe('richTextImageLayout (justified rows)', () => {
  describe('groupConsecutiveImages', () => {
    it('returns empty string for empty input', () => {
      expect(groupConsecutiveImages('')).toBe('');
    });

    it('returns input unchanged if no images', () => {
      const html = '<p>Hello world</p><p>Another paragraph</p>';
      expect(groupConsecutiveImages(html)).toBe(html);
    });

    it('wraps a single landscape image in a justified row with its own aspect bucket', () => {
      const html = '<p>Text before</p><p><img src="test.jpg" width="900" height="600"></p><p>Text after</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-150">');
      expect(result).toContain('</div>');
    });

    it('wraps a single portrait image in a justified row clamped to the minimum bucket', () => {
      const html = '<p>Text before</p><p><img src="test.jpg" width="600" height="800"></p><p>Text after</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-100">');
    });

    it('packs two landscapes into one full-width row', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="1200" height="800"></p><p><img src="2.jpg" width="1200" height="800"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-300">');
      expect(result.match(/img-jrow/g)?.length).toBe(1);
    });

    it('packs two portraits into one row', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="600" height="800"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-150">');
      expect(result.match(/img-jrow/g)?.length).toBe(1);
    });

    it('packs portrait + landscape into one mixed row', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="1200" height="800"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-225">');
      expect(result.match(/img-jrow/g)?.length).toBe(1);
    });

    it('packs three portraits into one row of three', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="600" height="800"></p><p><img src="3.jpg" width="600" height="800"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-225">');
      expect(result.match(/img-jrow/g)?.length).toBe(1);
    });

    it('never leaves a lone trailing portrait: 4 portraits become 2+2', () => {
      const html = '<p>Text</p>' +
        '<p><img src="1.jpg" width="600" height="800"></p>' +
        '<p><img src="2.jpg" width="600" height="800"></p>' +
        '<p><img src="3.jpg" width="600" height="800"></p>' +
        '<p><img src="4.jpg" width="600" height="800"></p>' +
        '<p>Text</p>';
      const result = groupConsecutiveImages(html);
      const rows = result.match(/<div class="img-jrow jrow-ar-150">/g);
      expect(rows?.length).toBe(2);
      expect(result.match(/img-jrow/g)?.length).toBe(2);
    });

    it('allows a trailing landscape to stand alone as a full-width row', () => {
      // P(0.75) + L(1.5) close the first row; the trailing landscape keeps its own row.
      const html = '<p>Text</p>' +
        '<p><img src="1.jpg" width="600" height="800"></p>' +
        '<p><img src="2.jpg" width="1200" height="800"></p>' +
        '<p><img src="3.jpg" width="1200" height="800"></p>' +
        '<p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-225">');
      expect(result).toContain('<div class="img-jrow jrow-ar-150">');
      expect(result.match(/img-jrow/g)?.length).toBe(2);
    });

    it('caps a row at three images even when aspects stay below target', () => {
      const html = '<p>Text</p>' +
        '<p><img src="1.jpg" width="500" height="900"></p>'.repeat(1) +
        '<p><img src="2.jpg" width="500" height="900"></p>' +
        '<p><img src="3.jpg" width="500" height="900"></p>' +
        '<p><img src="4.jpg" width="500" height="900"></p>' +
        '<p><img src="5.jpg" width="500" height="900"></p>' +
        '<p><img src="6.jpg" width="500" height="900"></p>' +
        '<p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result.match(/img-jrow/g)?.length).toBe(2);
    });

    it('expands multiple image-only tags inside one paragraph before grouping them', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="700" height="900"><img src="2.jpg" width="1200" height="700"><img src="3.jpg" width="700" height="900"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-jrow');
      expect(result).not.toContain('<p><img src="1.jpg" width="700" height="900"><img src="2.jpg" width="1200" height="700"><img src="3.jpg" width="700" height="900"></p>');
    });

    it('handles images with br tags', () => {
      const html = '<p><img src="test.jpg" width="600" height="800"><br></p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-jrow');
    });

    it('treats images without dimensions as 4:3', () => {
      // Two unknown-ratio images: 1.33 + 1.33 = 2.66 → one row, bucket 275.
      const html = '<p><img src="1.jpg"></p><p><img src="2.jpg"></p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-275">');
    });

    it('reads aspect from inline style when width/height attributes are missing', () => {
      const html = '<p><img src="test.jpg" style="aspect-ratio: 3 / 2"></p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-jrow jrow-ar-150">');
    });
  });

  describe('removeImageLayoutClasses', () => {
    it('removes img-jrow wrapper', () => {
      const html = '<div class="img-jrow jrow-ar-150"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-jrow');
      expect(result).toContain('<p><img src="1.jpg"></p>');
    });

    it('removes legacy img-row-2 wrapper', () => {
      const html = '<div class="img-row-2"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-row-2');
      expect(result).toContain('<p><img src="1.jpg"></p>');
    });

    it('removes legacy img-grid wrapper', () => {
      const html = '<div class="img-grid"><p><img src="1.jpg"></p></div>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-grid');
    });

    it('removes legacy float classes from paragraphs', () => {
      const html = '<p class="img-float-right figure-portrait"><img src="test.jpg"></p>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-float-right');
      expect(result).not.toContain('figure-portrait');
      expect(result).toContain('<img src="test.jpg">');
    });

    it('removes legacy single-wide class from paragraphs', () => {
      const html = '<p class="img-single-wide figure-landscape"><img src="test.jpg"></p>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-single-wide');
      expect(result).not.toContain('figure-landscape');
      expect(result).toContain('<img src="test.jpg">');
    });
  });

  describe('applySmartImageLayout', () => {
    it('cleans existing layout and reapplies', () => {
      const html = '<div class="img-jrow jrow-ar-275"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>';
      const result = applySmartImageLayout(html);
      expect(result).toContain('img-jrow');
      expect(result.match(/img-jrow/g)?.length).toBe(1);
    });

    it('migrates legacy grid markup to justified rows without nesting', () => {
      const html = '<p>Before</p><div class="img-pair-portraits img-row-2 img-row-2-portrait"><div class="img-pair-portraits img-row-2 img-row-2-portrait"><p><img src="1.jpg" width="600" height="900"></p><p><img src="2.jpg" width="600" height="900"></p></div></div><p>After</p>';
      const result = applySmartImageLayout(html);
      expect(result).not.toContain('img-row-2');
      expect(result).not.toContain('img-pair-portraits');
      expect(result.match(/img-jrow/g)?.length).toBe(1);
    });

    it('handles null/undefined gracefully', () => {
      expect(applySmartImageLayout(null as unknown as string)).toBe('');
      expect(applySmartImageLayout(undefined as unknown as string)).toBe('');
    });

    // Load-bearing (travel/672 phantom draft): каждый сейв прогоняет описание через
    // applySmartImageLayout. Не идемпотентный трансформ дрейфует HTML при каждом
    // прогоне, и перезаписанный после сейва черновик перестаёт быть смыслово
    // равным серверному описанию — всплывает ложный диалог восстановления.
    // Трансформ ОБЯЗАН быть идемпотентным.
    it('is idempotent — repeated passes produce identical output (no whitespace drift)', () => {
      const cases = [
        '<p>Intro.</p><p class="img-float-right figure-portrait"><img src="https://metravel.by/address-image/1/c.webp"></p><p>Outro.</p>',
        '<p class="figure-portrait">plain</p>',
        '<div class="img-row-2"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>',
        '<div class="img-jrow jrow-ar-225"><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="1200" height="800"></p></div>',
        '<p data-block="a" class="img-single-wide figure-landscape">x</p>',
        '<p>Text</p><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="600" height="800"></p><p><img src="3.jpg" width="600" height="800"></p><p><img src="4.jpg" width="600" height="800"></p><p>Text</p>',
      ];
      for (const html of cases) {
        const once = applySmartImageLayout(html);
        const twice = applySmartImageLayout(once);
        expect(twice).toBe(once);
        // и никакого удвоения пробелов между `<p` и `class`
        expect(once).not.toMatch(/<p {2,}/);
      }
    });
  });
});
