// __tests__/services/pdf-v2/HtmlBuilder.test.ts
// ✅ ТЕСТЫ: HtmlBuilder v2

import { HtmlBuilder } from '../../../services/pdf-export/generators/v2/builders/HtmlBuilder';

describe('HtmlBuilder', () => {
  let builder: HtmlBuilder;

  beforeEach(() => {
    builder = new HtmlBuilder();
  });

  describe('addPage', () => {
    it('добавляет страницу', () => {
      builder.addPage('<div>Page 1</div>');
      expect(builder.getPageCount()).toBe(1);
    });

    it('возвращает this для chaining', () => {
      const result = builder.addPage('<div>Page</div>');
      expect(result).toBe(builder);
    });
  });

  describe('addPages', () => {
    it('добавляет несколько страниц', () => {
      builder.addPages(['<div>Page 1</div>', '<div>Page 2</div>', '<div>Page 3</div>']);
      expect(builder.getPageCount()).toBe(3);
    });

    it('возвращает this для chaining', () => {
      const result = builder.addPages(['<div>Page</div>']);
      expect(result).toBe(builder);
    });
  });

  describe('setHead', () => {
    it('устанавливает head секцию', () => {
      const head = '<meta name="author" content="Test">';
      builder.setHead(head);
      const html = builder.build();
      expect(html).toContain(head);
    });

    it('возвращает this для chaining', () => {
      const result = builder.setHead('<meta>');
      expect(result).toBe(builder);
    });
  });

  describe('setStyles', () => {
    it('устанавливает стили', () => {
      const styles = 'body { margin: 0; }';
      builder.setStyles(styles);
      const html = builder.build();
      expect(html).toContain(styles);
    });

    it('возвращает this для chaining', () => {
      const result = builder.setStyles('body {}');
      expect(result).toBe(builder);
    });
  });

  describe('build', () => {
    it('создает валидный HTML документ', () => {
      builder
        .addPage('<div>Page 1</div>')
        .setStyles('body { margin: 0; }');

      const html = builder.build();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('</head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('включает все страницы', () => {
      builder
        .addPage('<div id="page1">Page 1</div>')
        .addPage('<div id="page2">Page 2</div>');

      const html = builder.build();

      expect(html).toContain('page1');
      expect(html).toContain('page2');
    });

    it('включает стили в <style>', () => {
      const styles = 'body { color: red; }';
      builder.setStyles(styles);

      const html = builder.build();

      expect(html).toContain('<style>');
      expect(html).toContain(styles);
      expect(html).toContain('</style>');
    });

    it('работает с пустыми страницами', () => {
      const html = builder.build();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<body>');
    });
  });

  describe('reset', () => {
    it('очищает все данные', () => {
      builder
        .addPage('<div>Page</div>')
        .setStyles('body {}')
        .setHead('<meta>');

      builder.reset();

      expect(builder.getPageCount()).toBe(0);

      const html = builder.build();
      expect(html).not.toContain('Page');
      expect(html).not.toContain('body {}');
      expect(html).not.toContain('<meta>');
    });

    it('возвращает this для chaining', () => {
      const result = builder.reset();
      expect(result).toBe(builder);
    });
  });

  describe('getPageCount', () => {
    it('возвращает 0 для нового билдера', () => {
      expect(builder.getPageCount()).toBe(0);
    });

    it('возвращает правильное количество страниц', () => {
      builder
        .addPage('<div>1</div>')
        .addPage('<div>2</div>')
        .addPages(['<div>3</div>', '<div>4</div>']);

      expect(builder.getPageCount()).toBe(4);
    });
  });

  describe('fluent API', () => {
    it('позволяет цепочку вызовов', () => {
      const html = builder
        .setStyles('body { margin: 0; }')
        .setHead('<meta name="test">')
        .addPage('<div>Page 1</div>')
        .addPage('<div>Page 2</div>')
        .build();

      expect(html).toContain('Page 1');
      expect(html).toContain('Page 2');
      expect(html).toContain('body { margin: 0; }');
    });
  });

  describe('HTML structure', () => {
    it('устанавливает UTF-8 charset', () => {
      const html = builder.build();
      expect(html).toContain('charset="UTF-8"');
    });

    it('устанавливает viewport', () => {
      const html = builder.build();
      expect(html).toContain('name="viewport"');
    });

    it('устанавливает title', () => {
      const html = builder.build();
      expect(html).toContain('<title>');
    });

    it('устанавливает lang="ru"', () => {
      const html = builder.build();
      expect(html).toContain('lang="ru"');
    });
  });
});

