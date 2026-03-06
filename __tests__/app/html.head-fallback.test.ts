import fs from 'fs'
import path from 'path'

describe('critical head fallback', () => {
  it('keeps explicit home title and description in +html fallback script', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("const HOME_TITLE = 'Идеи поездок на выходные и книга путешествий | Metravel'")
    expect(source).toContain("const HOME_DESCRIPTION = 'Подбирайте маршруты по расстоянию и формату отдыха, сохраняйте поездки с фото и заметками и собирайте личную книгу путешествий в PDF.'")
    expect(source).toContain("meta[name=\"description\"]")
  })

  it('keeps dedicated article fallback title and description in +html fallback script', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("const ARTICLE_FALLBACK_TITLE = 'Статья | Metravel'")
    expect(source).toContain("const ARTICLE_FALLBACK_DESCRIPTION = 'Страница статьи в Metravel. Открывайте материалы о путешествиях, маршрутах и полезных находках.'")
    expect(source).toContain("p.indexOf('/article/')===0")
  })
})
