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

  it('replaces generic travel title/description fallbacks and noindexes service routes early', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("t==='Путешествие | Metravel'")
    expect(source).toContain("d==='Загружаем описание путешествия…'")
    expect(source).toContain("normalized==='/travel/new'")
    expect(source).toContain("normalized==='/travels/create'")
    expect(source).toContain("isAssetLikePath(path)")
    expect(source).toContain("upsertMeta('meta[name=\"robots\"]',{name:'robots'},routeMeta.robots||'noindex, nofollow')")
  })

  it('allows large image previews on production pages', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("isProduction ? 'max-image-preview:large' : 'noindex,nofollow'")
  })
})
