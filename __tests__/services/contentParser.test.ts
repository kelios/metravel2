import { ContentParser } from '@/src/services/pdf-export/parsers/ContentParser'

describe('ContentParser', () => {
  let parser: ContentParser

  beforeEach(() => {
    parser = new ContentParser()
  })

  it('merges adjacent paragraphs and normalizes invisible characters', () => {
    const html = `
      <p>Первый&nbsp;параграф<br/>с переносом</p>
      <p> Второй   </p>
      Невидимый\u200Bтекст
    `

    const blocks = parser.parse(html)

    expect(blocks).toEqual([
      {
        type: 'paragraph',
        text: 'Первый параграф с переносом Второй Невидимый текст',
      },
    ])
  })

  it('parses structural blocks like lists, quotes, images and tables', () => {
    const html = `
      <h2>Маршрут</h2>
      <ul><li>Пункт 1</li><li>Пункт 2</li></ul>
      <blockquote>Мудрость<cite>Автор</cite></blockquote>
      <figure><img src="https://example.com/img.jpg" alt="альт"/><figcaption>Подпись</figcaption></figure>
      <figure><img src="a.jpg"/><img src="b.jpg"/></figure>
      <table>
        <tr><th>Колонка</th><th>Значение</th></tr>
        <tr><td>Один</td><td>Два</td></tr>
      </table>
    `

    const blocks = parser.parse(html)

    const heading = blocks.find((block) => block.type === 'heading') as any
    expect(heading.level).toBe(2)
    expect(heading.text).toBe('Маршрут')

    const list = blocks.find((block) => block.type === 'list') as any
    expect(list.items).toEqual(['Пункт 1', 'Пункт 2'])
    expect(list.ordered).toBe(false)

    const quote = blocks.find((block) => block.type === 'quote') as any
    expect(quote.text).toBe('Мудрость')
    expect(quote.author).toBe('Автор')

    const image = blocks.find((block) => block.type === 'image') as any
    expect(image.src).toBe('https://example.com/img.jpg')
    expect(image.caption).toBe('Подпись')

    const gallery = blocks.find((block) => block.type === 'image-gallery') as any
    expect(gallery.images).toHaveLength(2)
    expect(gallery.columns).toBe(2)

    const table = blocks.find((block) => block.type === 'table') as any
    expect(table.headers).toEqual(['Колонка', 'Значение'])
    expect(table.rows).toEqual([['Один', 'Два']])
  })

  it('detects special info blocks and cleans react-native wrappers', () => {
    const html = `
      <View><Text>Внутри RN обертки</Text></View>
      <div class="tip"><strong>Важно</strong> Следуйте совету</div>
    `

    const blocks = parser.parse(html)

    expect(blocks[0]).toEqual({
      type: 'paragraph',
      text: 'Внутри RN обертки',
    })

    const tip = blocks[1] as any
    expect(tip.type).toBe('tip-block')
    expect(tip.title).toBe('Важно')
    expect(tip.content).toContain('Следуйте совету')
  })
})
