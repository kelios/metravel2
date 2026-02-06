// src/services/pdf-export/generators/v2/builders/HtmlBuilder.ts
// ✅ СТРОИТЕЛЬ: Построение HTML документа

/**
 * Строитель HTML документа с Fluent API
 */
export class HtmlBuilder {
  private pages: string[] = [];
  private head: string = '';
  private styles: string = '';

  /**
   * Добавляет страницу
   */
  addPage(html: string): this {
    this.pages.push(html);
    return this;
  }

  /**
   * Добавляет несколько страниц
   */
  addPages(pages: string[]): this {
    this.pages.push(...pages);
    return this;
  }

  /**
   * Устанавливает head секцию
   */
  setHead(head: string): this {
    this.head = head;
    return this;
  }

  /**
   * Устанавливает стили
   */
  setStyles(styles: string): this {
    this.styles = styles;
    return this;
  }

  /**
   * Строит итоговый HTML
   */
  build(): string {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travel Book</title>
  <link rel="manifest" href="data:application/json,%7B%7D">
  ${this.head}
  <style>
    ${this.styles}
  </style>
</head>
<body>
  ${this.pages.join('\n')}
</body>
</html>
    `.trim();
  }

  /**
   * Сбрасывает состояние билдера
   */
  reset(): this {
    this.pages = [];
    this.head = '';
    this.styles = '';
    return this;
  }

  /**
   * Получает количество страниц
   */
  getPageCount(): number {
    return this.pages.length;
  }
}

