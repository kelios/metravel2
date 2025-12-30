// __tests__/services/pdf-export/themes/PdfThemeConfig.test.ts
import {
  PdfThemeConfig,
  PDF_THEMES,
  getThemeConfig,
  blackWhiteTheme,
  sepiaTheme,
  newspaperTheme,
} from '../../../../src/services/pdf-export/themes/PdfThemeConfig';

describe('PdfThemeConfig - Новые темы', () => {
  describe('Черно-белая тема (black-white)', () => {
    it('должна быть зарегистрирована в реестре тем', () => {
      expect(PDF_THEMES['black-white']).toBeDefined();
      expect(PDF_THEMES['black-white']).toBe(blackWhiteTheme);
    });

    it('должна иметь правильное название и описание', () => {
      expect(blackWhiteTheme.name).toBe('black-white');
      expect(blackWhiteTheme.displayName).toBe('Черно-белая');
      expect(blackWhiteTheme.description).toContain('монохромная');
    });

    it('должна использовать только оттенки серого', () => {
      expect(blackWhiteTheme.colors.text).toMatch(/#[0-9a-fA-F]{6}/);
      expect(blackWhiteTheme.colors.accent).toBe('#000000');
      expect(blackWhiteTheme.colors.background).toBe('#ffffff');
    });

    it('должна иметь четкие границы', () => {
      expect(blackWhiteTheme.blocks.borderWidth).toBe('2px');
      expect(blackWhiteTheme.blocks.borderRadius).toBe('4px');
    });

    it('должна использовать классические шрифты', () => {
      expect(blackWhiteTheme.typography.headingFont).toContain('Helvetica');
      expect(blackWhiteTheme.typography.bodyFont).toContain('Georgia');
    });
  });

  describe('Сепия тема (sepia)', () => {
    it('должна быть зарегистрирована в реестре тем', () => {
      expect(PDF_THEMES.sepia).toBeDefined();
      expect(PDF_THEMES.sepia).toBe(sepiaTheme);
    });

    it('должна иметь правильное название и описание', () => {
      expect(sepiaTheme.name).toBe('sepia');
      expect(sepiaTheme.displayName).toBe('Сепия');
      expect(sepiaTheme.description).toContain('винтажная');
    });

    it('должна использовать теплые коричневые тона', () => {
      expect(sepiaTheme.colors.background).toBe('#f5f1e8');
      expect(sepiaTheme.colors.text).toContain('#3e2723');
      expect(sepiaTheme.colors.accent).toContain('#8d6e63');
    });

    it('должна иметь винтажные закругления', () => {
      expect(sepiaTheme.blocks.borderRadius).toBe('8px');
      expect(sepiaTheme.blocks.borderWidth).toBe('1.5px');
    });

    it('должна использовать serif шрифты', () => {
      expect(sepiaTheme.typography.headingFont).toContain('Merriweather');
      expect(sepiaTheme.typography.bodyFont).toContain('Crimson Text');
    });
  });

  describe('Газетная тема (newspaper)', () => {
    it('должна быть зарегистрирована в реестре тем', () => {
      expect(PDF_THEMES.newspaper).toBeDefined();
      expect(PDF_THEMES.newspaper).toBe(newspaperTheme);
    });

    it('должна иметь правильное название и описание', () => {
      expect(newspaperTheme.name).toBe('newspaper');
      expect(newspaperTheme.displayName).toBe('Цветная газета');
      expect(newspaperTheme.description).toContain('газет');
    });

    it('должна использовать яркий красный акцент', () => {
      expect(newspaperTheme.colors.accent).toBe('#c8102e');
      expect(newspaperTheme.colors.accentStrong).toBe('#a00d26');
    });

    it('должна иметь минимальные закругления для газетного стиля', () => {
      expect(newspaperTheme.blocks.borderRadius).toBe('2px');
      expect(newspaperTheme.blocks.shadow).toBe('none');
      expect(newspaperTheme.blocks.borderWidth).toBe('2px');
    });

    it('должна использовать крупные заголовки', () => {
      expect(newspaperTheme.typography.h1.size).toBe('42pt');
      expect(newspaperTheme.typography.h1.weight).toBe(900);
    });

    it('должна иметь меньшие отступы для колоночной верстки', () => {
      expect(newspaperTheme.spacing.pagePadding).toBe('20mm');
      expect(newspaperTheme.spacing.columnGap).toBe('14pt');
    });

    it('должна использовать газетные шрифты', () => {
      expect(newspaperTheme.typography.headingFont).toContain('Libre Franklin');
      expect(newspaperTheme.typography.bodyFont).toContain('PT Serif');
    });
  });

  describe('getThemeConfig', () => {
    it('должна возвращать черно-белую тему по имени', () => {
      const theme = getThemeConfig('black-white');
      expect(theme).toBe(blackWhiteTheme);
    });

    it('должна возвращать тему сепия по имени', () => {
      const theme = getThemeConfig('sepia');
      expect(theme).toBe(sepiaTheme);
    });

    it('должна возвращать газетную тему по имени', () => {
      const theme = getThemeConfig('newspaper');
      expect(theme).toBe(newspaperTheme);
    });

    it('должна возвращать minimal тему для неизвестного имени', () => {
      const theme = getThemeConfig('unknown-theme');
      expect(theme.name).toBe('minimal');
    });
  });

  describe('Структура всех новых тем', () => {
    const newThemes: PdfThemeConfig[] = [
      blackWhiteTheme,
      sepiaTheme,
      newspaperTheme,
    ];

    newThemes.forEach((theme) => {
      describe(`Тема: ${theme.displayName}`, () => {
        it('должна иметь все обязательные свойства', () => {
          expect(theme.name).toBeDefined();
          expect(theme.displayName).toBeDefined();
          expect(theme.description).toBeDefined();
        });

        it('должна иметь полную цветовую палитру', () => {
          expect(theme.colors.text).toBeDefined();
          expect(theme.colors.textSecondary).toBeDefined();
          expect(theme.colors.textMuted).toBeDefined();
          expect(theme.colors.background).toBeDefined();
          expect(theme.colors.surface).toBeDefined();
          expect(theme.colors.surfaceAlt).toBeDefined();
          expect(theme.colors.accent).toBeDefined();
          expect(theme.colors.accentStrong).toBeDefined();
          expect(theme.colors.accentSoft).toBeDefined();
          expect(theme.colors.accentLight).toBeDefined();
          expect(theme.colors.border).toBeDefined();
          expect(theme.colors.borderLight).toBeDefined();
        });

        it('должна иметь цвета для всех типов блоков', () => {
          expect(theme.colors.infoBlock).toBeDefined();
          expect(theme.colors.warningBlock).toBeDefined();
          expect(theme.colors.tipBlock).toBeDefined();
          expect(theme.colors.dangerBlock).toBeDefined();

          [
            theme.colors.infoBlock,
            theme.colors.warningBlock,
            theme.colors.tipBlock,
            theme.colors.dangerBlock,
          ].forEach((block) => {
            expect(block.background).toBeDefined();
            expect(block.border).toBeDefined();
            expect(block.text).toBeDefined();
            expect(block.icon).toBeDefined();
          });
        });

        it('должна иметь цвета для обложки', () => {
          expect(theme.colors.cover.background).toBeDefined();
          expect(theme.colors.cover.backgroundGradient).toHaveLength(2);
          expect(theme.colors.cover.text).toBeDefined();
          expect(theme.colors.cover.textSecondary).toBeDefined();
        });

        it('должна иметь полную типографику', () => {
          expect(theme.typography.headingFont).toBeDefined();
          expect(theme.typography.bodyFont).toBeDefined();
          expect(theme.typography.monoFont).toBeDefined();

          ['h1', 'h2', 'h3', 'h4'].forEach((heading) => {
            expect(theme.typography[heading as 'h1'].size).toBeDefined();
            expect(theme.typography[heading as 'h1'].weight).toBeDefined();
            expect(theme.typography[heading as 'h1'].lineHeight).toBeDefined();
            expect(theme.typography[heading as 'h1'].marginBottom).toBeDefined();
          });

          expect(theme.typography.body.size).toBeDefined();
          expect(theme.typography.body.lineHeight).toBeDefined();
          expect(theme.typography.body.marginBottom).toBeDefined();

          expect(theme.typography.small.size).toBeDefined();
          expect(theme.typography.small.lineHeight).toBeDefined();

          expect(theme.typography.caption.size).toBeDefined();
          expect(theme.typography.caption.lineHeight).toBeDefined();
        });

        it('должна иметь настройки отступов', () => {
          expect(theme.spacing.pagePadding).toBeDefined();
          expect(theme.spacing.sectionSpacing).toBeDefined();
          expect(theme.spacing.blockSpacing).toBeDefined();
          expect(theme.spacing.elementSpacing).toBeDefined();
          expect(theme.spacing.contentMaxWidth).toBeDefined();
          expect(theme.spacing.columnGap).toBeDefined();
        });

        it('должна иметь настройки блоков', () => {
          expect(theme.blocks.borderRadius).toBeDefined();
          expect(theme.blocks.shadow).toBeDefined();
          expect(theme.blocks.borderWidth).toBeDefined();
        });
      });
    });
  });

  describe('Реестр тем PDF_THEMES', () => {
    it('должен содержать все 12 тем', () => {
      const themeCount = Object.keys(PDF_THEMES).length;
      expect(themeCount).toBe(12);
    });

    it('должен содержать все новые темы', () => {
      expect(PDF_THEMES['black-white']).toBeDefined();
      expect(PDF_THEMES.sepia).toBeDefined();
      expect(PDF_THEMES.newspaper).toBeDefined();
    });

    it('все темы должны быть валидными', () => {
      Object.values(PDF_THEMES).forEach((theme: PdfThemeConfig) => {
        expect(theme.name).toBeDefined();
        expect(theme.displayName).toBeDefined();
        expect(theme.colors).toBeDefined();
        expect(theme.typography).toBeDefined();
        expect(theme.spacing).toBeDefined();
        expect(theme.blocks).toBeDefined();
      });
    });
  });
});

