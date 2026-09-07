import { sanitizeArticleEditorNativeContent, normalizeArticleEditorHtmlForOutput } from '@/components/article/articleEditorConfig'
import { sanitizeArticleEditorHtml } from '@/utils/articleEditorSanitize'
import { normalizeQuillListMarkup, normalizeRichTextListFragments } from '@/utils/richTextLists'
import { sanitizeRichText } from '@/utils/sanitizeRichText'

// #1866 / #1768: allowlist редактора статей уже дважды молча уносил семантику
// Quill — сперва целые теги FAQ, затем атрибуты, различающие тип списка. Набор
// ниже перечисляет форматы, которые доезжают до тела статьи: часть даёт тулбар
// (`QUILL_TOOLBAR_BY_VARIANT`, `components/article/articleEditorConfig.ts:19`),
// остальные приходят вставкой и из уже сохранённых тел — их читатель умеет
// рисовать (`components/travel/stableContent/webStyles/typography.ts`), а
// backend `safe_html` пропускает. Любая будущая правка allowlist, которая
// снимет тег или атрибут, красит этот файл, а не всплывает через месяц на
// живой статье.
type QuillFormatCase = {
  /** Разметка ровно в том виде, в каком её отдаёт Quill 2. */
  input: string
  /** Признаки, без которых формат у читателя перестаёт быть собой. */
  keeps: (string | RegExp)[]
}

const QUILL_FORMAT_CASES: Record<string, QuillFormatCase> = {
  bold: { input: '<p><strong>жирный</strong></p>', keeps: ['<strong>'] },
  italic: { input: '<p><em>курсив</em></p>', keeps: ['<em>'] },
  underline: { input: '<p><u>подчёркнутый</u></p>', keeps: ['<u>'] },
  strike: { input: '<p><s>зачёркнутый</s></p>', keeps: ['<s>'] },
  link: {
    input: '<p><a href="https://metravel.by/">ссылка</a></p>',
    keeps: ['href="https://metravel.by/"'],
  },
  h1: { input: '<h1>Заголовок</h1>', keeps: ['<h1>'] },
  h2: { input: '<h2>Заголовок</h2>', keeps: ['<h2>'] },
  h3: { input: '<h3>Заголовок</h3>', keeps: ['<h3>'] },
  h4: { input: '<h4>Заголовок</h4>', keeps: ['<h4>'] },
  h5: { input: '<h5>Заголовок</h5>', keeps: ['<h5>'] },
  h6: { input: '<h6>Заголовок</h6>', keeps: ['<h6>'] },
  blockquote: { input: '<blockquote>цитата</blockquote>', keeps: ['<blockquote>'] },
  codeBlock: {
    input: '<pre class="ql-syntax" spellcheck="false">const a = 1;</pre>',
    keeps: ['<pre', 'const a = 1;'],
  },
  inlineCode: { input: '<p><code>npm run lint</code></p>', keeps: ['<code>'] },
  bulletList: {
    input:
      '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Пункт</li></ol>',
    // Тип списка переживает downstream только как тег: backend safe_html
    // (`metravel/common/rich_text.py`, GLOBAL_ATTRS без `data-list`) снимает атрибут.
    keeps: ['<ul>', 'Пункт'],
  },
  orderedList: {
    input:
      '<ol><li data-list="ordered"><span class="ql-ui" contenteditable="false"></span>Пункт</li></ol>',
    keeps: ['<ol>', 'Пункт'],
  },
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

describe('sanitizeArticleEditorHtml — форматы редактора не теряют своих признаков', () => {
  it.each(Object.entries(QUILL_FORMAT_CASES))('%s', (_name, { input, keeps }) => {
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
