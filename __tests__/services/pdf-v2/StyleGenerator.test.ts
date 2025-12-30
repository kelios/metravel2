// __tests__/services/pdf-v2/StyleGenerator.test.ts
// ✅ ТЕСТЫ: StyleGenerator v2

import { StyleGenerator } from '../../../src/services/pdf-export/generators/v2/builders/StyleGenerator';
import { getThemeConfig } from '../../../src/services/pdf-export/themes/PdfThemeConfig';

describe('StyleGenerator', () => {
  let generator: StyleGenerator;

  beforeEach(() => {
    const theme = getThemeConfig('minimal');
    generator = new StyleGenerator(theme);
  });

  describe('heading', () => {
    it('генерирует стиль для h1', () => {
      const style = generator.heading(1);
      expect(style).toContain('font-size');
      expect(style).toContain('font-weight');
      expect(style).toContain('line-height');
    });

    it('генерирует стиль для h2', () => {
      const style = generator.heading(2);
      expect(style).toContain('font-size');
      expect(style).toContain('font-weight');
    });

    it('генерирует стиль для h3', () => {
      const style = generator.heading(3);
      expect(style).toBeTruthy();
    });

    it('генерирует стиль для h4', () => {
      const style = generator.heading(4);
      expect(style).toBeTruthy();
    });
  });

  describe('paragraph', () => {
    it('генерирует стиль для параграфа', () => {
      const style = generator.paragraph();
      expect(style).toContain('font-size');
      expect(style).toContain('line-height');
      expect(style).toContain('margin');
    });
  });

  describe('section', () => {
    it('генерирует стиль для секции', () => {
      const style = generator.section();
      expect(style).toContain('padding');
    });

    it('принимает кастомный padding', () => {
      const style = generator.section('40px');
      expect(style).toContain('40px');
    });
  });

  describe('page', () => {
    it('генерирует стиль для страницы', () => {
      const style = generator.page();
      expect(style).toContain('width');
      expect(style).toContain('min-height');
      expect(style).toContain('page-break-after');
    });
  });

  describe('button', () => {
    it('генерирует стиль для кнопки', () => {
      const style = generator.button();
      expect(style).toContain('background');
      expect(style).toContain('padding');
      expect(style).toContain('border-radius');
    });
  });

  describe('card', () => {
    it('генерирует стиль для карточки', () => {
      const style = generator.card();
      expect(style).toContain('background');
      expect(style).toContain('border-radius');
      expect(style).toContain('padding');
    });
  });

  describe('generateGlobalStyles', () => {
    it('генерирует полный CSS', () => {
      const css = generator.generateGlobalStyles();
      expect(css).toContain('body');
      expect(css).toContain('h1');
      expect(css).toContain('h2');
      expect(css).toContain('p');
      expect(css).toContain('.page');
    });

    it('включает reset стили', () => {
      const css = generator.generateGlobalStyles();
      expect(css).toContain('margin: 0');
      expect(css).toContain('padding: 0');
      expect(css).toContain('box-sizing: border-box');
    });

    it('включает стили изображений', () => {
      const css = generator.generateGlobalStyles();
      expect(css).toContain('img');
      expect(css).toContain('max-width: 100%');
    });
  });

  describe('theme support', () => {
    it('работает с разными темами', () => {
      const themes = ['minimal', 'elegant', 'adventure'];

      for (const themeName of themes) {
        const theme = getThemeConfig(themeName as any);
        const gen = new StyleGenerator(theme);
        const css = gen.generateGlobalStyles();
        expect(css).toBeTruthy();
        expect(css.length).toBeGreaterThan(100);
      }
    });
  });
});

