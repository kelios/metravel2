import { buildArticleEditorNativeHtml } from '@/components/article/articleEditorNativeHtml'

// #1041 — native rich-text редактор (Quill в WebView). Билдер чистый, поэтому
// контракт «работает офлайн» и «команды из RN доходят на Android» проверяем без
// рендера WebView.
const build = (variant: 'default' | 'compact' = 'default') =>
  buildArticleEditorNativeHtml({
    borderColor: '#e0e0e0',
    placeholder: JSON.stringify('Напишите текст'),
    initialContent: JSON.stringify('<p>hello</p>'),
    surfaceColor: '#ffffff',
    surfaceElevatedColor: '#fafafa',
    textColor: '#111111',
    textSecondaryColor: '#777777',
    variant,
  })

describe('buildArticleEditorNativeHtml', () => {
  // Регрессия: движок тянулся с cdn.jsdelivr.net — без сети редактор
  // открывался пустым и без сообщения об ошибке.
  it('inlines the Quill engine instead of loading it from a CDN', () => {
    const html = build()

    expect(html).not.toContain('cdn.jsdelivr.net')
    expect(html).not.toContain('<link href="https://')
    expect(html).not.toContain('<script src="https://')
    // Инлайн-движок и его тема реально попали в документ.
    expect(html).toContain('.ql-editor')
    expect(html).toContain('Quill')
  })

  // Регрессия: RN доставляет postMessage на Android в document, а слушатель
  // висел только на window — ни одна команда из RN не доходила.
  it('listens for host messages on both document and window', () => {
    const html = build()

    expect(html).toContain("document.addEventListener('message', handleHostMessage)")
    expect(html).toContain("window.addEventListener('message', handleHostMessage)")
  })

  it('handles every RN → WebView command', () => {
    const html = build()

    expect(html).toContain("data.type === 'set-content'")
    expect(html).toContain("data.type === 'insert-image'")
    expect(html).toContain("data.type === 'undo'")
    expect(html).toContain("data.type === 'redo'")
    expect(html).toContain("data.type === 'insert-anchor'")
  })

  it('reports readiness and content changes back to RN', () => {
    const html = build()

    expect(html).toContain("type: 'ready'")
    expect(html).toContain("type: 'content-change'")
    expect(html).toContain("type: 'request-image-upload'")
  })

  it('embeds the provided initial content and placeholder', () => {
    const html = build()

    expect(html).toContain('<p>hello</p>')
    expect(html).toContain('Напишите текст')
  })

  it('applies compact toolbar sizing only for the compact variant', () => {
    expect(build('compact')).toContain('.ql-toolbar button { width: 32px; height: 32px; }')
    expect(build('default')).not.toContain('.ql-toolbar button { width: 32px; height: 32px; }')
  })
})
