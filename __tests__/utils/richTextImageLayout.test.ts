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

    it('adds float class to single image between text', () => {
      const html = '<p>Text before</p><p><img src="test.jpg"></p><p>Text after</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-float-right"');
    });

    it('alternates float direction for multiple single images', () => {
      const html = `
        <p>Text</p>
        <p><img src="1.jpg"></p>
        <p>Text</p>
        <p><img src="2.jpg"></p>
        <p>Text</p>
      `;
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-float-right"');
      expect(result).toContain('class="img-float-left"');
    });

    it('wraps 2 consecutive images in img-row-2', () => {
      const html = '<p>Text</p><p><img src="1.jpg"></p><p><img src="2.jpg"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-row-2">');
      expect(result).toContain('</div>');
    });

    it('wraps 3+ consecutive images in img-grid', () => {
      const html = '<p>Text</p><p><img src="1.jpg"></p><p><img src="2.jpg"></p><p><img src="3.jpg"></p><p>Text</p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('<div class="img-grid">');
    });

    it('handles images with br tags', () => {
      const html = '<p><img src="test.jpg"><br></p>';
      const result = groupConsecutiveImages(html);
      expect(result).toContain('class="img-float-right"');
    });

    it('handles images with attributes', () => {
      const html = '<p><img src="test.jpg" width="800" height="600" alt="Test"></p>';
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
