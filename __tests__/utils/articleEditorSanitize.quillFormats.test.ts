import { QUILL_TOOLBAR_BY_VARIANT, sanitizeArticleEditorNativeContent, normalizeArticleEditorHtmlForOutput } from '@/components/article/articleEditorConfig'
import { sanitizeArticleEditorHtml } from '@/utils/articleEditorSanitize'
import { normalizeQuillListMarkup, normalizeRichTextListFragments } from '@/utils/richTextLists'
import { sanitizeRichText } from '@/utils/sanitizeRichText'

// The real toolbar (including Quill's default picker options) owns this matrix.
// A new format or option must declare a semantic witness before it can pass.
const Quill = jest.requireActual('quill/dist/quill.js') as typeof import('quill').default

type ToolbarFormat = { format: string; value: string | number | boolean }
const expandToolbar = (toolbar: readonly unknown[]): ToolbarFormat[] => toolbar.flatMap((entry) => {
  if (Array.isArray(entry)) return expandToolbar(entry)
  if (typeof entry === 'string') return [{ format: entry, value: true }]
  if (!entry || typeof entry !== 'object') throw new Error('Unsupported toolbar entry')
  return Object.entries(entry).flatMap(([format, configured]) => {
    let values = Array.isArray(configured) ? configured : [configured]
    if (values.length === 0) {
      const host = document.createElement('div')
      document.body.appendChild(host)
      const editor = new Quill(host, { theme: 'snow', modules: { toolbar: [[{ [format]: [] }]] } })
      const module = editor.getModule('toolbar') as { container: HTMLElement }
      const picker = module.container.querySelector('select')
      if (!picker || picker.options.length === 0) throw new Error(`Uncovered picker: ${format}`)
      values = Array.from(picker.options, (option) => option.value || false)
      module.container.remove()
      host.remove()
    }
    return values.map((value) => ({ format, value: value as ToolbarFormat['value'] }))
  })
})

const semanticWitness = ({ format, value }: ToolbarFormat): string => {
  const simple: Record<string, string> = {
    bold: '<strong>', italic: '<em>', underline: '<u>', strike: '<s>',
    link: 'href="https://example.com/"', image: 'src="https://example.com/image.jpg"',
    clean: '<p>Формат</p>',
  }
  if (Object.hasOwn(simple, format) && value === true) return simple[format]
  if (value === false && ['font', 'size', 'align', 'header'].includes(format)) return '<p>Формат</p>'
  if (format === 'header' && [1, 2, 3, 4, 5, 6].includes(Number(value))) return `<h${value}>`
  if (format === 'list' && ['ordered', 'bullet'].includes(String(value))) return value === 'bullet' ? '<ul>' : '<ol>'
  const supported: Record<string, readonly (string | number)[]> = {
    align: ['center', 'right', 'justify'], font: ['serif', 'monospace'],
    size: ['small', 'large', 'huge'], indent: [1, 2, 3, 4, 5, 6, 7, 8],
  }
  if (supported[format]?.includes(value as string | number)) return `class="ql-${format}-${value}"`
  throw new Error(`Uncovered toolbar format/option: ${format}:${value}`)
}

const createEditor = () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new Quill(host, { modules: { toolbar: false } })
}

type QuillFormatCase = {
  /** Разметка ровно в том виде, в каком её отдаёт Quill 2. */
  input: string
  /** Признаки, без которых формат у читателя перестаёт быть собой. */
  keeps: (string | RegExp)[]
}

const STORED_CONTENT_CASES: Record<string, QuillFormatCase> = {
  h4: { input: '<h4>Заголовок</h4>', keeps: ['<h4>'] },
  h5: { input: '<h5>Заголовок</h5>', keeps: ['<h5>'] },
  h6: { input: '<h6>Заголовок</h6>', keeps: ['<h6>'] },
  blockquote: { input: '<blockquote>цитата</blockquote>', keeps: ['<blockquote>'] },
  codeBlock: {
    input: '<pre class="ql-syntax" spellcheck="false">const a = 1;</pre>',
    keeps: ['<pre', 'const a = 1;'],
  },
  inlineCode: { input: '<p><code>npm run lint</code></p>', keeps: ['<code>'] },
  nestedList: {
    input:
      '<ol><li data-list="bullet" class="ql-indent-1"><span class="ql-ui" contenteditable="false"></span>Вложенный</li></ol>',
    keeps: ['<ul>', 'class="ql-indent-1"'],
  },
  image: {
    input: '<p><img src="https://metravel.by/a.jpg" alt="Подпись" title="Заголовок"></p>',
    keeps: ['src="https://metravel.by/a.jpg"', 'alt="Подпись"', 'title="Заголовок"'],
  },
  video: {
    input:
      '<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/abc"></iframe>',
    keeps: ['<iframe', 'class="ql-video"', 'src="https://www.youtube.com/embed/abc"'],
  },
  faq: {
    input:
      '<section class="seo-faq" itemscope itemtype="https://schema.org/FAQPage"><details itemscope itemprop="mainEntity"><summary itemprop="name">Вопрос</summary><p>Ответ</p></details></section>',
    keeps: ['<section', 'itemtype="https://schema.org/FAQPage"', '<details', '<summary'],
  },
}

describe('every toolbar format survives actual Quill output and reopen', () => {
  afterEach(() => { document.body.innerHTML = '' })

  const toolbarCases = Object.entries(QUILL_TOOLBAR_BY_VARIANT).flatMap(([variant, toolbar]) =>
    expandToolbar(toolbar).map((selection) => [`${variant}/${selection.format}:${selection.value}`, selection] as const),
  )

  it.each(toolbarCases)('%s', (_name, selection) => {
    const editor = createEditor()
    const witness = semanticWitness(selection)
    const { format, value } = selection
    editor.setText('Формат')
    if (format === 'image') editor.insertEmbed(0, 'image', 'https://example.com/image.jpg')
    else if (format === 'clean') {
      editor.formatText(0, 6, 'bold', true)
      editor.removeFormat(0, 6)
    } else if (['header', 'list', 'align', 'indent'].includes(format)) editor.formatLine(0, 6, format, value)
    else editor.formatText(0, 6, format, format === 'link' ? 'https://example.com/' : value)
    const originalFormats = editor.getFormat(0, 6)
    const saved = sanitizeArticleEditorHtml(editor.root.innerHTML)
    expect(saved).toContain(witness)
    editor.setContents(editor.clipboard.convert({ html: saved }))
    expect(editor.getFormat(0, 6)).toEqual(originalFormats)
  })

  it.each(Object.entries(QUILL_TOOLBAR_BY_VARIANT))('%s toolbar omits color controls that cannot survive saving', (_variant, toolbar) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = new Quill(host, { theme: 'snow', modules: { toolbar } })
    const module = editor.getModule('toolbar') as { container: HTMLElement }

    expect(module.container.querySelectorAll('.ql-color, .ql-background')).toHaveLength(0)
  })

  it('fails deterministically for a new format, unknown option or reintroduced unsupported color control', () => {
    for (const extra of [['script'], [{ size: ['unknown-size'] }], [{ color: [] }], [{ background: [] }]]) {
      const expanded = expandToolbar([...QUILL_TOOLBAR_BY_VARIANT.compact, extra])
      expect(() => expanded.forEach(semanticWitness)).toThrow('Uncovered toolbar format/option')
    }
  })
})

describe('stored and pasted content keeps its semantic attributes', () => {
  it.each(Object.entries(STORED_CONTENT_CASES))('%s', (_name, { input, keeps }) => {
    const output = sanitizeArticleEditorHtml(input)

    for (const marker of keeps) {
      if (typeof marker === 'string') expect(output).toContain(marker)
      else expect(output).toMatch(marker)
    }
  })
})

describe('нормализация транспортной разметки списков Quill', () => {
  it('маркированный список сохраняется семантическим <ul> без служебного span', () => {
    const output = sanitizeArticleEditorHtml(
      '<ol>' +
        '<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Палатка</li>' +
        '<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Спальник</li>' +
        '</ol>',
    )

    expect(output).toBe('<ul><li>Палатка</li><li>Спальник</li></ul>')
    expect(output).not.toContain('<span>')
    expect(output).not.toContain('data-list')
  })

  it('нумерованный список остаётся <ol> — обратной регрессии нет', () => {
    const output = sanitizeArticleEditorHtml(
      '<ol>' +
        '<li data-list="ordered"><span class="ql-ui" contenteditable="false"></span>Первый</li>' +
        '<li data-list="ordered"><span class="ql-ui" contenteditable="false"></span>Второй</li>' +
        '</ol>',
    )

    expect(output).toBe('<ol><li>Первый</li><li>Второй</li></ol>')
  })

  it('смешанный блок Quill режется на пробеги по типу пункта', () => {
    expect(
      normalizeQuillListMarkup(
        '<ol>' +
          '<li data-list="ordered">Раз</li>' +
          '<li data-list="bullet">Точка</li>' +
          '<li data-list="ordered">Два</li>' +
          '</ol>',
      ),
    ).toBe('<ol><li>Раз</li></ol><ul><li>Точка</li></ul><ol><li>Два</li></ol>')
  })

  it('уровень вложенности пункта переживает сохранение', () => {
    expect(
      sanitizeArticleEditorHtml(
        '<ol>' +
          '<li data-list="bullet">Верхний</li>' +
          '<li data-list="bullet" class="ql-indent-1">Вложенный</li>' +
          '</ol>',
      ),
    ).toBe('<ul><li>Верхний</li><li class="ql-indent-1">Вложенный</li></ul>')
  })

  it('чужой класс на пункте списка внутрь статьи не проходит', () => {
    expect(sanitizeArticleEditorHtml('<ol><li data-list="bullet" class="evil">Пункт</li></ol>')).toBe(
      '<ul><li>Пункт</li></ul>',
    )
  })

  it('уже сохранённые списки без data-list не переписываются', () => {
    const stored = '<ul><li>Палатка</li></ul><ol><li>Первый</li></ol>'
    expect(normalizeQuillListMarkup(stored)).toBe(stored)
  })

  it('пробельный <span> </span> отдаёт свой пробел наружу — слова не слипаются', () => {
    // Форма из живых тел статей (travel 438, 194, 228, 532): такой span —
    // единственный разделитель слов, удаление его вместе с содержимым склеило бы текст.
    expect(normalizeQuillListMarkup('<p>таинственные<span> </span>знаки</p>')).toBe(
      '<p>таинственные знаки</p>',
    )
    // Голым такой span делает как раз allowlist редактора: `span` разрешает
    // только `id`, поэтому после санитизации остаётся `<span> </span>`.
    expect(sanitizeArticleEditorHtml('<p>закрыта<span style="color:#000"> </span>(сумма входа)</p>')).toBe(
      '<p>закрыта (сумма входа)</p>',
    )
    // В санитайзере чтения такой span переживает вместе со стилем — склейки нет и там.
    expect(sanitizeRichText('<p>закрыта<span style="color:#000"> </span>(сумма входа)</p>')).toContain(
      '> </span>(сумма входа)',
    )
  })

  it('легаси-хвост <span></span> вычищается, а якорь <span id> остаётся', () => {
    expect(normalizeQuillListMarkup('<ol><li><span></span>Пункт</li></ol>')).toBe(
      '<ol><li>Пункт</li></ol>',
    )
    expect(normalizeQuillListMarkup('<p><span id="anchor"></span>Текст</p>')).toBe(
      '<p><span id="anchor"></span>Текст</p>',
    )
  })

  it('блок с незакрытым пунктом не переписывается — текст пункта не пропадает', () => {
    const broken = '<ol><li data-list="bullet">Палатка</li><li data-list="bullet">Спальник</ol>'

    expect(normalizeQuillListMarkup(broken)).toBe(broken)
    // sanitize-html достраивает `</li>`, поэтому тип списка доезжает до тега,
    // а не теряется вместе со вторым пунктом.
    expect(sanitizeArticleEditorHtml(broken)).toBe('<ul><li>Палатка</li><li>Спальник</li></ul>')
  })

  it('текст между пунктами и вложенный список блок не ломают', () => {
    const withStrayText = '<ol>Сборы<li data-list="bullet">Палатка</li></ol>'
    const nested =
      '<ol><li data-list="bullet">Верхний<ol><li data-list="bullet">Вложенный</li></ol></li></ol>'

    expect(normalizeQuillListMarkup(withStrayText)).toBe(withStrayText)
    expect(normalizeQuillListMarkup(nested)).toBe(nested)
  })

  it('запись тела статьи приводит список Quill к семантическому тегу', () => {
    // `sanitizeRichText` — единственный санитайзер на пути записи
    // (`api/misc.ts` → `sanitizeTravelBodyForWrite`), и через него идёт в том
    // числе сырой HTML native-редактора, который `sanitizeArticleEditorHtml`
    // не проходит вовсе (`ArticleEditor.ios.tsx:161` отдаёт html как есть).
    expect(
      sanitizeRichText(
        '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Пункт</li></ol>',
      ),
    ).toBe('<ul><li>Пункт</li></ul>')

    expect(
      sanitizeRichText('<ol><li data-list="ordered">Первый</li><li data-list="ordered">Второй</li></ol>'),
    ).toBe('<ol><li>Первый</li><li>Второй</li></ol>')
  })

  it('native-редактор сохраняет тот же семантический <ul>', () => {
    expect(
      sanitizeArticleEditorNativeContent(
        '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Пункт</li></ol>',
      ),
    ).toBe('<ul><li>Пункт</li></ul>')
  })

  it('полный выходной конвейер редактора отдаёт семантический список', () => {
    expect(
      normalizeArticleEditorHtmlForOutput(
        '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Пункт</li></ol>',
      ),
    ).toBe('<ul><li>Пункт</li></ul>')
  })
})

describe('чтение: список с data-list отрисовывается по своему типу', () => {
  it('<li data-list="bullet"> превращается в <ul> до нумерации', () => {
    expect(normalizeRichTextListFragments('<ol><li data-list="bullet">Точка</li></ol>')).toBe(
      '<ul><li>Точка</li></ul>',
    )
  })

  it('сквозная нумерация соседних <ol> сохраняется', () => {
    const output = normalizeRichTextListFragments(
      '<ol><li data-list="ordered">Раз</li><li data-list="ordered">Два</li></ol>' +
        '<ol><li data-list="ordered">Три</li></ol>',
    )

    expect(output).toBe('<ol><li>Раз</li><li>Два</li></ol><ol start="3"><li>Три</li></ol>')
  })
})


describe('Quill block formatting and bounded classes', () => {
  it.each(['p', 'h1', 'h2', 'h3', 'blockquote', 'li'])('keeps alignment and indent on %s', (tag) => {
    const source = `<${tag} class="ql-align-center ql-indent-8">Блок</${tag}>`
    expect(sanitizeArticleEditorHtml(source)).toContain('class="ql-align-center ql-indent-8"')
  })

  it('drops arbitrary classes, unknown fonts/sizes, unsupported indent levels, styles and handlers', () => {
    const source = '<p class="evil ql-align-left ql-indent-9 ql-indent-999" onclick="steal()">' +
      '<span class="ql-font-arbitrary ql-size-enormous evil" style="position:fixed;background:url(javascript:steal())">Текст</span></p>'
    expect(sanitizeArticleEditorHtml(source)).toBe('<p><span>Текст</span></p>')
  })
})
