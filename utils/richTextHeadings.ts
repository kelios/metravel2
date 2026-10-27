/** The enclosing article owns the page H1; authored headings start at H2. */
export const demoteRichTextPageHeadings = (html: string): string => html
  .replace(/<\s*h1(\b[^>]*)>/gi, '<h2$1>')
  .replace(/<\s*\/\s*h1\s*>/gi, '</h2>')
