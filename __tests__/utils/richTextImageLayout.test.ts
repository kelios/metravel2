import {
  groupConsecutiveImages,
  removeImageLayoutClasses,
  applySmartImageLayout,
} from '@/utils/richTextImageLayout';

describe('richTextImageLayout', () => {
  describe('groupConsecutiveImages', () => {
    it('returns empty string for empty input', () => {
      expect(groupConsecutiveImages('')).toBe('');
    });

    it('returns input unchanged if no images', () => {
      const html = '<p>Hello world</p><p>Another paragraph</p>';
      expect(groupConsecutiveImages(html)).toBe(html);
    });

    it('adds float class to single vertical image between text', () => {
      // Vertical image (600x800) should get float class
      const html = '<p>Text before</p><p><img src="test.jpg" width="600" height="800"></p><p>Text after</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-float-right"');
    });

    it('adds single-wide class to horizontal image', () => {
      // Horizontal image (800x600) should get single-wide class
      const html = '<p>Text before</p><p><img src="test.jpg" width="800" height="600"></p><p>Text after</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-single-wide"');
    });

    it('alternates float direction for multiple single vertical images', () => {
      // Vertical images should alternate float direction
      const html = `
        <p>Text</p>
        <p><img src="1.jpg" width="600" height="800"></p>
        <p>Text</p>
        <p><img src="2.jpg" width="600" height="800"></p>
        <p>Text</p>
      `;
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-float-right"');
      expect(result).toContain('class="img-float-left"');
    });

    it('wraps 2 consecutive images in img-row-2', () => {
      const html = '<p>Text</p><p><img src="1.jpg"></p><p><img src="2.jpg"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-row-2');
      expect(result).toContain('</div>');
    });

    it('wraps 2 portrait images in img-row-2-portrait', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="600" height="800"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-row-2-portrait');
    });

    it('wraps mixed pair (portrait + landscape) in a dedicated mixed row', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="800" height="600"></p><p><img src="2.jpg" width="600" height="800"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-row-2');
      expect(result).toContain('img-row-2-mixed');
    });

    it('wraps 3+ consecutive images in img-grid', () => {
      const html = '<p>Text</p><p><img src="1.jpg"></p><p><img src="2.jpg"></p><p><img src="3.jpg"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-grid">');
    });

    it('wraps 3 images with 1 portrait in a mixed grid layout', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="800" height="600"></p><p><img src="2.jpg" width="600" height="800"></p><p><img src="3.jpg" width="800" height="600"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-grid-mixed');
      expect(result).toContain('img-grid-mixed-stack');
    });

    it('wraps 4 landscape-heavy images in a quilt grid', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="1200" height="700"></p><p><img src="2.jpg" width="1000" height="700"></p><p><img src="3.jpg" width="1100" height="700"></p><p><img src="4.jpg" width="1200" height="720"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-grid');
      expect(result).toContain('img-grid-quilt');
    });

    it('wraps 4 balanced mixed-orientation images in a balanced grid', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="1200" height="700"></p><p><img src="2.jpg" width="700" height="1100"></p><p><img src="3.jpg" width="700" height="1100"></p><p><img src="4.jpg" width="1200" height="700"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-grid');
      expect(result).toContain('img-grid-balanced');
    });

    it('wraps 3 images with 2+ portraits in img-grid-portrait', () => {
      const html = '<p>Text</p><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="600" height="800"></p><p><img src="3.jpg" width="800" height="600"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('img-grid-portrait');
    });

    it('handles vertical images with br tags', () => {
      const html = '<p><img src="test.jpg" width="600" height="800"><br></p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-float-right"');
    });

    it('handles horizontal images with attributes', () => {
      // 800x600 is landscape, should get single-wide
      const html = '<p><img src="test.jpg" width="800" height="600" alt="Test"></p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-single-wide"');
    });

    it('handles images without dimensions as float (fallback)', () => {
      // No dimensions = can't determine orientation, treated as non-landscape
      const html = '<p><img src="test.jpg"></p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-float-right"');
    });
  });

  describe('removeImageLayoutClasses', () => {
    it('removes img-row-2 wrapper', () => {
      const html = '<div class="img-row-2"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-row-2');
      expect(result).toContain('<p><img src="1.jpg"></p>');
    });

    it('removes img-grid wrapper', () => {
      const html = '<div class="img-grid"><p><img src="1.jpg"></p></div>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-grid');
    });

    it('removes float classes from paragraphs', () => {
      const html = '<p class="img-float-right"><img src="test.jpg"></p>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-float-right');
      expect(result).toContain('<p><img src="test.jpg"></p>');
    });

    it('removes single-wide class from paragraphs', () => {
      const html = '<p class="img-single-wide"><img src="test.jpg"></p>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-single-wide');
      expect(result).toContain('<p><img src="test.jpg"></p>');
    });
  });

  describe('applySmartImageLayout', () => {
    it('cleans existing layout and reapplies', () => {
      const html = '<div class="img-row-2"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>';
      const result = applySmartImageLayout(html);
      // Should still have img-row-2 after reprocessing
      expect(result).toContain('img-row-2');
    });

    it('handles null/undefined gracefully', () => {
      expect(applySmartImageLayout(null as unknown as string)).toBe('');
      expect(applySmartImageLayout(undefined as unknown as string)).toBe('');
    });
  });
});
