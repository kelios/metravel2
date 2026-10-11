import { resolvePhotoTextFlow } from '@/services/pdf-export/renderers/blockRenderer/photoTextFlow'
import type { ImageBlock, ParagraphBlock, ParsedContentBlock } from '@/services/pdf-export/parsers/ContentParser'

const paragraph = (text = 'Длинный абзац о путешествии сохраняет все слова и помогает читать рассказ рядом с фотографией.'): ParagraphBlock => ({
  type: 'paragraph', text, html: `<a href="https://example.org/travel">${text}</a>`,
})
const image = (src = 'one.jpg', layout: ImageBlock['layout'] = 'float-right'): ImageBlock => ({ type: 'image', src, layout, alt: 'Photo', caption: 'Caption' })
const heading: ParsedContentBlock = { type: 'heading', level: 2, text: 'Следующий раздел' }

describe('PDF photo/paragraph display association', () => {
  it.each(['float-left', 'float-right'] as const)('associates an orphan %s without modifying the source blocks', (side) => {
    const text = paragraph(), photo = image('one.jpg', side)
    const source = Object.freeze([Object.freeze(text), Object.freeze(photo), Object.freeze(heading)])
    expect(resolvePhotoTextFlow(source)).toEqual([
      { type: 'photo-text', image: photo, paragraph: text }, { type: 'block', block: heading },
    ])
    expect(source).toEqual([text, photo, heading])
    expect(resolvePhotoTextFlow(source)).toEqual(resolvePhotoTextFlow(source))
  })

  it('associates at end and retains empty paragraphs without losing their HTML', () => {
    const text = paragraph(), empty = paragraph(''), photo = image()
    expect(resolvePhotoTextFlow([text, empty, photo, empty])).toEqual([
      { type: 'photo-text', image: photo, paragraph: text },
      { type: 'block', block: empty }, { type: 'block', block: empty },
    ])
  })

  it('leaves an existing forward wrap unchanged even with short following text', () => {
    const blocks = [paragraph(), image(), paragraph('Текст рядом.'), heading]
    expect(resolvePhotoTextFlow(blocks)).toEqual(blocks.map((block) => ({ type: 'block', block })))
  })

  it('does not steal any paragraph in an earlier float flow, not only its first paragraph', () => {
    const blocks = [paragraph(), image('one.jpg'), paragraph(), paragraph(), image('two.jpg'), heading]
    const result = resolvePhotoTextFlow(blocks)
    expect(result).toEqual(blocks.map((block) => ({ type: 'block', block })))
  })

  it.each<ParsedContentBlock>([
    heading, { type: 'list', ordered: false, items: ['Point'] },
    { type: 'table', rows: [['Cell']] }, { type: 'image-gallery', images: [{ src: 'group.jpg' }] },
    { type: 'tip-block', content: 'Tip' },
  ])('does not cross a $type boundary', (boundary) => {
    const blocks = [paragraph(), boundary, image(), heading]
    expect(resolvePhotoTextFlow(blocks)).toEqual(blocks.map((block) => ({ type: 'block', block })))
  })

  it('does not pair full-width photos or short preceding text', () => {
    for (const blocks of [[paragraph(), image('wide.jpg', 'single-wide')], [paragraph('Коротко.'), image()]]) {
      expect(resolvePhotoTextFlow(blocks)).toEqual(blocks.map((block) => ({ type: 'block', block })))
    }
  })

  it('keeps text/link bytes and media occurrence order across multiple independent sections', () => {
    const first = paragraph(), second = paragraph('Ещё один длинный абзац сохраняет именно авторский текст, ссылку, подпись и смысл раздела.')
    const photos = [image('one.jpg'), image('two.jpg', 'float-left')]
    const blocks = [first, photos[0], heading, second, photos[1], heading]
    const flow = resolvePhotoTextFlow(blocks)
    expect(flow.filter((item) => item.type === 'photo-text').map((item) => item.image.src)).toEqual(['one.jpg', 'two.jpg'])
    expect(flow.filter((item) => item.type === 'photo-text').map((item) => item.paragraph.html)).toEqual([first.html, second.html])
  })
})
