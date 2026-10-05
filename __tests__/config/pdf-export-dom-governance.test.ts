/**
 * @jest-environment node
 *
 * #2119 — PDF-книга в приложениях: общий путь сборки книги не трогает браузерные
 * глобалы.
 *
 * В Hermes нет `DOMParser`, `document`, `Node`, `HTMLElement`, `Image`: первое же
 * обращение — ReferenceError, и книга в приложении не собирается (так было до
 * #2119: ContentParser разбирал описания через `DOMParser`). Дерево HTML читается
 * через `parsers/contentParser/htmlTree`, а всё браузерное живёт в платформенных
 * файлах `*.web.ts`, которые в приложение не попадают.
 *
 * Страж судит код (комментарии срезаны) и проверен на настоящем исходнике
 * ContentParser с возвращённым `new DOMParser()` — негативная проба ниже.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Общий путь книги: генераторы, разбор, рендер и сервис документа. */
const SCAN_DIRS = ['services/pdf-export', 'services/book'];

/** Платформенные web-файлы в приложение не собираются — им браузерные глобалы разрешены. */
const isWebOnlyFile = (file: string): boolean => /\.web\.tsx?$/.test(file);

const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
  { name: 'DOMParser', pattern: /\bDOMParser\b/ },
  { name: 'document.*', pattern: /(?<![.\w$])document\s*\.\s*[A-Za-z_$]/ },
  { name: 'Node.*_NODE', pattern: /(?<![.\w$])Node\s*\.\s*[A-Z_]+_NODE\b/ },
  { name: 'instanceof HTMLElement/Element/Node', pattern: /\binstanceof\s+(?:HTML[A-Za-z]*Element|Element|Node)\b/ },
  { name: 'new Image()', pattern: /\bnew\s+Image\s*\(/ },
];

/**
 * Единственное разрешённое исключение: замер пропорций картинок браузерным
 * `Image`. Он стоит за проверкой `typeof Image === 'undefined'` — в приложении
 * замер пропускается, а не падает (решение #2119 записано рядом с кодом).
 */
const GUARDED_EXCEPTIONS: Record<string, { name: string; guard: RegExp }> = {
  'services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts': {
    name: 'new Image()',
    guard: /typeof\s+Image\s*===\s*'undefined'/,
  },
};

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

export function findDomViolations(source: string, file = ''): string[] {
  const code = stripComments(source);
  const exception = GUARDED_EXCEPTIONS[file];
  return FORBIDDEN.filter(({ name, pattern }) => {
    if (!pattern.test(code)) return false;
    if (exception && exception.name === name && exception.guard.test(code)) return false;
    return true;
  }).map(({ name }) => name);
}

const allFiles = SCAN_DIRS.flatMap((dir) => walk(dir)).sort();
const sharedFiles = allFiles.filter((file) => !isWebOnlyFile(file));
const webFiles = allFiles.filter(isWebOnlyFile);

describe('PDF-книга без браузерных глобалов в общем пути (#2119)', () => {
  it('охват: разбор, дерево приложений, генератор и сервис книги под стражем', () => {
    for (const file of [
      'services/pdf-export/parsers/ContentParser.ts',
      'services/pdf-export/parsers/contentParser/htmlTree.ts',
      'services/pdf-export/parsers/contentParser/htmlTree.native.ts',
      'services/pdf-export/renderers/BlockRenderer.ts',
      'services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts',
      'services/pdf-export/TravelDataTransformer.ts',
      'services/book/BookHtmlExportService.ts',
      'services/book/bookPrintChrome.native.ts',
    ]) {
      expect(sharedFiles).toContain(file);
    }
  });

  it('браузерные файлы — только платформенные *.web.ts', () => {
    expect(webFiles).toEqual([
      'services/book/bookPrintChrome.web.ts',
      'services/pdf-export/parsers/contentParser/htmlTree.web.ts',
    ]);
    // Web-разбор — действительно браузерный: иначе страж охранял бы пустое место.
    const webTree = fs.readFileSync(
      path.join(ROOT, 'services/pdf-export/parsers/contentParser/htmlTree.web.ts'),
      'utf8'
    );
    expect(findDomViolations(webTree)).toContain('DOMParser');
  });

  it.each(sharedFiles)('%s: без DOMParser, document, Node.*, instanceof HTMLElement', (file) => {
    expect(findDomViolations(fs.readFileSync(path.join(ROOT, file), 'utf8'), file)).toEqual([]);
  });

  describe('негативная проба на настоящем исходнике ContentParser', () => {
    const file = 'services/pdf-export/parsers/ContentParser.ts';
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const treeCall = 'const body = this.parseHtmlBody(cleaned);';

    it('исходник содержит точку входа в дерево HTML', () => {
      expect(source).toContain(treeCall);
    });

    it('возврат `new DOMParser()` ловится', () => {
      const regressed = source.replace(
        treeCall,
        "const body = new DOMParser().parseFromString(cleaned, 'text/html').body;"
      );
      expect(findDomViolations(regressed, file)).toEqual(['DOMParser']);
    });

    it('возврат `document.createTextNode`, `Node.TEXT_NODE` и `instanceof HTMLElement` ловится', () => {
      const regressed = source
        .replace("text += lineBreak;", "clone.replaceWith(document.createTextNode(lineBreak));")
        .replace('child.nodeType === HTML_TEXT_NODE', 'child.nodeType === Node.TEXT_NODE')
        .replace('isHtmlElement(cite)', 'cite instanceof HTMLElement');
      expect(findDomViolations(regressed, file)).toEqual([
        'document.*',
        'Node.*_NODE',
        'instanceof HTMLElement/Element/Node',
      ]);
    });

    it('упоминание в комментарии нарушением не считается', () => {
      expect(findDomViolations('// раньше здесь был new DOMParser() и document.createTextNode\nconst a = 1;')).toEqual([]);
    });

    it('`new Image()` без проверки наличия ловится, с проверкой — нет', () => {
      const guarded = "if (typeof Image === 'undefined') return; const img = new Image();";
      const base = 'services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts';
      expect(findDomViolations(guarded, base)).toEqual([]);
      expect(findDomViolations('const img = new Image();', base)).toEqual(['new Image()']);
      expect(findDomViolations(guarded, 'services/pdf-export/renderers/BlockRenderer.ts')).toEqual(['new Image()']);
    });
  });
});
