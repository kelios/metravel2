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

  it('keeps inactive toolbar controls visible in dark editor surfaces', () => {
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-stroke')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('stroke: var(--color-textMuted);')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('fill: var(--color-textMuted);')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('button[disabled]')
    expect(ARTICLE_EDITOR_QUILL_WEB_CSS).toContain('stroke: var(--color-textSubtle);')
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
