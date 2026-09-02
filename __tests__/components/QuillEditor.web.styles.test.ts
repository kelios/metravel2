import {
  applyQuillAccessibility,
  ARTICLE_EDITOR_QUILL_WEB_CSS,
} from '@/components/article/QuillEditor.web'

describe('QuillEditor.web styles', () => {
  it('keeps travel editor layout rules scoped to the article editor chrome', () => {
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('[data-editor-chrome="article-editor"] .ql-container.ql-snow')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('[data-editor-chrome="article-editor"] .ql-editor img')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('[data-editor-chrome="article-editor"] .ql-editor img + *')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).not.toMatch(/(^|\n)\.ql-editor img\s*\{/)
  })

  it('defines a single scroll owner for desktop and compact editor bodies', () => {
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('[data-editor-chrome="article-editor"][data-fullscreen="false"][data-compact="false"] .ql-container.ql-snow')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('[data-editor-chrome="article-editor"][data-fullscreen="false"][data-compact="true"] .ql-container.ql-snow')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('overflow-y: auto;')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('overflow: hidden;')
  })

  // Регрессия: на телефоне системное меню выделения ("Вырезать / Копировать / …")
  // рисуется над выделением и закрывало верхнюю панель форматирования — ссылку и
  // картинку было нечем вставить. Панель док-бар снизу, как и в Android-редакторе.
  it('docks the mobile toolbar below the editor body', () => {
    const mobileBlock = ARTICLE_EDITOR_QUILL_WEB_CSS.slice(
      ARTICLE_EDITOR_QUILL_WEB_CSS.indexOf('@media (max-width: 767px)'),
      ARTICLE_EDITOR_QUILL_WEB_CSS.indexOf('@media (max-width: 479px)'),
    )

    expect(mobileBlock).toContain('order: 2;')
    expect(mobileBlock).toContain('order: 1;')
    expect(mobileBlock).toContain('border-top: 1px solid var(--color-border);')
    expect(mobileBlock).toContain('padding-bottom: 72px;')
    // Десктопная панель остаётся сверху.
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS.slice(0, ARTICLE_EDITOR_QUILL_WEB_CSS.indexOf('@media'))).toContain(
      'border-bottom: 1px solid var(--color-border);',
    )
  })

  it('keeps inactive toolbar controls visible in dark editor surfaces', () => {
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-stroke')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('stroke: var(--color-textMuted);')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('fill: var(--color-textMuted);')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('button[disabled]')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('stroke: var(--color-textSubtle);')
  })

  // Регрессия: тема quill.snow красит тело редактора под светлый фон — плейсхолдер
  // rgba(0,0,0,.6), ссылки #06c, рамки #ccc/#000, подложка кода #f0f0f0 и белый
  // тултип. На тёмной теме это давало 1.3–2.6:1. Тело редактора красится токенами.
  it('themes the editor body instead of leaving quill.snow light-only colors', () => {
    const rule = (selector: string) => {
      const start = ARTICLE_EDITOR_QUILL_WEB_CSS.indexOf(`${selector} {`)
      expect(start).toBeGreaterThan(-1)
      return ARTICLE_EDITOR_QUILL_WEB_CSS.slice(
        start,
        ARTICLE_EDITOR_QUILL_WEB_CSS.indexOf('}', start),
      )
    }
    const chrome = '[data-editor-chrome="article-editor"]'

    expect(rule(`${chrome} .ql-editor`)).toContain('color: var(--color-text);')
    expect(rule(`${chrome} .ql-editor.ql-blank::before`)).toContain('color: var(--color-textMuted);')
    expect(rule(`${chrome} .ql-editor a`)).toContain('color: var(--color-primaryText);')
    expect(rule(`${chrome} .ql-editor td`)).toContain('border-color: var(--color-textSubtle);')
    expect(rule(`${chrome} .ql-snow .ql-tooltip`)).toContain('background-color: var(--color-surfaceElevated);')
    expect(rule(`${chrome} .ql-snow .ql-tooltip`)).toContain('color: var(--color-text);')
  })

  // Вендорные правила `.ql-snow .ql-editor <тег>` весомее, чем `[chrome] .ql-editor <тег>`,
  // поэтому переопределения для них обязаны нести в селекторе ещё и `.ql-snow`.
  it('outweighs the vendor rules that already carry .ql-snow', () => {
    for (const selector of ['blockquote', 'code', 'li > .ql-ui']) {
      expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain(
        `[data-editor-chrome="article-editor"] .ql-snow .ql-editor ${selector} {`,
      )
    }
  })

  it('names picker controls and adds fallback alt text to editor images', () => {
    const toolbar = document.createElement('div')
    toolbar.innerHTML = [
      '<span class="ql-picker ql-font"><span class="ql-picker-label"></span></span>',
      '<span class="ql-picker ql-size"><span class="ql-picker-label" aria-label="Custom size"></span></span>',
    ].join('')
    const root = document.createElement('div')
    root.innerHTML = '<img src="/missing-alt.jpg"><img src="/described.jpg" alt="Авторское описание">'

    applyQuillAccessibility({ root }, toolbar)

    expect(toolbar.querySelector('.ql-font .ql-picker-label')?.getAttribute('aria-label')).toBe('Font')
    expect(toolbar.querySelector('.ql-size .ql-picker-label')?.getAttribute('aria-label')).toBe('Custom size')
    expect(root.querySelector('img[src="/missing-alt.jpg"]')?.getAttribute('alt')).toBe('Изображение')
    expect(root.querySelector('img[src="/described.jpg"]')?.getAttribute('alt')).toBe('Авторское описание')
  })
})
