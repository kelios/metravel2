import fs from 'fs'
import path from 'path'

/**
 * #2170: оболочка документа. Шрифт иконок не объявляется в `<head>` и не идёт
 * в `preload` — ранний запрос шрифта браузер ставит выше LCP-картинки (замер
 * прода 04.10.2026: +190 мс LCP главной и статьи). Его регистрирует скрипт
 * после разметки приложения, когда картинка первого экрана уже в DOM.
 */
describe('+html: шрифт иконок и логотип', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
  const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>'))
  const body = source.slice(source.indexOf('<body>'), source.indexOf('</body>'))

  it('регистрирует шрифт иконок после разметки приложения', () => {
    expect(body).toContain('buildIconFontLoaderScript(iconFontUrl)')
    expect(body.indexOf('{children}')).toBeGreaterThan(-1)
    expect(body.indexOf('buildIconFontLoaderScript(iconFontUrl)')).toBeGreaterThan(body.indexOf('{children}'))
    // До entry-бандла: иконки не должны ждать исполнения скриптов приложения.
    expect(body.indexOf('buildIconFontLoaderScript(iconFontUrl)')).toBeLessThan(
      body.indexOf('buildUnknownCityNotFoundHydrationScript()'),
    )
  })

  it('не объявляет шрифт в <head>: ни preload, ни @font-face, ни статической регистрации expo-font', () => {
    expect(head).not.toMatch(/as=["']font["']/)
    expect(head).not.toContain('buildIconFontLoaderScript')
    expect(source).not.toMatch(/useFonts|loadAsync|registerStaticFont/)
  })

  it('берёт адрес шрифта из реестра ассетов сборки, а не из строки в исходнике', () => {
    expect(source).toContain('Asset.fromModule(Feather.font[ICON_FONT_FAMILY]).uri')
    expect(source).not.toMatch(/Feather\.[0-9a-f]{8,}\.ttf|Fonts\/Feather\.ttf/)
  })

  it('ставит preload логотипа без fetchpriority — позади LCP-картинки, впереди скриптов', () => {
    const link = head.match(/<link rel="preload" as="image" href=\{HEADER_LOGO_WEB_SRC\}[^>]*\/>/)?.[0]
    expect(link).toBeTruthy()
    expect(link).not.toMatch(/fetchPriority/i)
  })

  it('иконочным гарнитурам expo-font ставит block, а не swap', () => {
    expect(head).toContain('buildFontDisplayPolicyScript()')
    expect(source).not.toContain('getFontFaceSwapScript')
  })
})
