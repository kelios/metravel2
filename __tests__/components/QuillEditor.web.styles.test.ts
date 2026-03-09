import { ARTICLE_EDITOR_QUILL_WEB_CSS } from '@/components/article/QuillEditor.web'

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
})
