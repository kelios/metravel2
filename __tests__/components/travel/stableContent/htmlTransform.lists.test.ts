import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { normalizeRichTextListFragments } from '@/utils/richTextLists'

describe('rich text list fragments', () => {
  it('continues ordered list numbering across ql-indent bullet fragments', () => {
    const html = [
      '<h2>Основные точки маршрута</h2>',
      '<ol><li><strong>Старт</strong></li><li>Парковка</li></ol>',
      '<ul><li class="ql-indent-1">Каскад ручьев</li></ul>',
      '<ol><li><strong>Церковь Святого Николая</strong></li></ol>',
      '<ul><li class="ql-indent-1">Родник</li></ul>',
      '<ol><li><strong>Родник Святого Юрия</strong></li></ol>',
    ].join('')

    const out = prepareStableContentHtml(html, { serverSanitized: true })

    expect(out).toMatch(/<ol[^>]*start="3"[^>]*>\s*<li><strong>Церковь Святого Николая<\/strong><\/li>/)
    expect(out).toMatch(/<ol[^>]*start="4"[^>]*>\s*<li><strong>Родник Святого Юрия<\/strong><\/li>/)
    expect(out).toContain('class="ql-indent-1"')
  })

  it('does not continue numbering after non-list content', () => {
    const out = normalizeRichTextListFragments(
      '<ol><li>Первый</li></ol><p>Новый блок</p><ol><li>Снова первый</li></ol>',
    )

    expect(out).toBe('<ol><li>Первый</li></ol><p>Новый блок</p><ol><li>Снова первый</li></ol>')
  })
})
