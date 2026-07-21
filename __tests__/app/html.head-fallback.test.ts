import fs from 'fs'
import path from 'path'

describe('critical head fallback', () => {
  it('keeps explicit home title and description in +html fallback script', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("const HOME_TITLE = i18nT('seoStatic:root.home.title')")
    expect(source).toContain("const HOME_DESCRIPTION = i18nT('seoStatic:root.home.description')")
    expect(source).toContain("meta[name=\"description\"]")
  })

  it('keeps dedicated article fallback title and description in +html fallback script', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("const ARTICLE_FALLBACK_TITLE = i18nT('seoStatic:root.article.title')")
    expect(source).toContain("const ARTICLE_FALLBACK_DESCRIPTION = i18nT('seoStatic:root.article.description')")
    expect(source).toContain("p.indexOf('/article/')===0")
  })

  it('replaces generic travel title/description fallbacks and noindexes service routes early', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("i18nT('seoStatic:critical.generic.travelTitle')")
    expect(source).toContain("i18nT('seoStatic:critical.generic.loadingDescription')")
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

  it('keeps browser zoom available in the web viewport contract', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain('viewport-fit=cover,maximum-scale=5')
    expect(source).not.toContain('user-scalable=no')
    expect(source).not.toContain('maximum-scale=1')
  })
})
