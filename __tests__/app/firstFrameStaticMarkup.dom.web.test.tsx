import type React from 'react'

/**
 * #2170: кадр до гидратации рисует браузер из статического HTML, и на медленной
 * сети он держится десятки секунд. Здесь — настоящий серверный рендер
 * react-native-web (тот же, что у статического экспорта), а не проп в
 * react-test-renderer: все три дефекта жили именно на границе «объект стиля →
 * разметка» и снимком пропов не ловились.
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let Feather: React.ComponentType<any> & { glyphMap: Record<string, number>; font: Record<string, unknown> }
let Logo: React.ComponentType<any>
let SkeletonLoader: React.ComponentType<any>
let HEADER_LOGO_WEB_SRC: string
let QuestsGridSkeleton: React.ComponentType<any>

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement } = require('react'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet } = require('react-native'))
  Feather = require('../../metro-stubs/FeatherHydrationSafe.web').default
  Logo = require('@/components/layout/Logo').default
  ;({ SkeletonLoader } = require('@/components/ui/SkeletonLoader'))
  ;({ HEADER_LOGO_WEB_SRC } = require('@/components/layout/headerLayoutContract'))
  ;({ QuestsGridSkeleton } = require('@/screens/tabs/QuestsCatalogPlaceholders'))
})

const toDom = (markup: string): HTMLElement => {
  const host = document.createElement('div')
  host.innerHTML = markup
  return host.firstElementChild as HTMLElement
}

/** Объявления всех атомарных классов узла — то, что реально применит браузер. */
const declarationsOf = (node: Element): string => {
  const sheet = StyleSheet.getSheet().textContent
  return Array.from(node.classList)
    .map((name) => {
      const match = sheet.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))
      return match ? match[1] : ''
    })
    .join('')
}

describe('статический HTML первого кадра (#2170)', () => {
  describe('web-иконка Feather', () => {
    it('несёт глиф уже в серверной разметке', () => {
      const node = toDom(renderToStaticMarkup(createElement(Feather, { name: 'map', size: 17, color: '#123456' })))

      expect(node.textContent).toBe(String.fromCodePoint(Feather.glyphMap.map))
      expect(node.getAttribute('data-icon-font')).toBe('feather')
      expect(declarationsOf(node)).toContain('font-family:feather')
    })

    it('держит свою клетку, пока шрифта нет: место не зависит от глифа запасного шрифта', () => {
      const node = toDom(renderToStaticMarkup(createElement(Feather, { name: 'map', size: 17 })))

      expect(node.style.minWidth).toBe('17px')
      expect(node.style.minHeight).toBe('17px')
      expect(node.style.fontSize).toBe('17px')
      // Жёсткой ширины нет: растянутая родителем иконка (страница /app) растягивается, как раньше.
      expect(node.style.width).toBe('')
    })

    it('одинакова на сервере и на клиенте: чистая функция пропсов без состояния и эффектов', () => {
      // forwardRef-рендер вызывается вне React — с хуком внутри он бы бросил.
      const element = (Feather as any).render({ name: 'globe', size: 17 }, null)
      expect(element.props.children[0]).toBe(String.fromCodePoint(Feather.glyphMap.globe))
    })

    it('сохраняет метку шрифта, когда вызывающий передал свой dataSet', () => {
      const node = toDom(
        renderToStaticMarkup(createElement(Feather, { name: 'map', dataSet: { headerLangChevron: 'true' } })),
      )
      expect(node.getAttribute('data-icon-font')).toBe('feather')
      expect(node.getAttribute('data-header-lang-chevron')).toBe('true')
    })

    it('оставляет статические поля обёртки Expo (glyphMap, font) — на них опирается оболочка документа', () => {
      expect(Feather.glyphMap.map).toEqual(expect.any(Number))
      expect(Object.keys(Feather.font)).toEqual(['feather'])
    })
  })

  describe('логотип бренд-строки', () => {
    it('есть в серверной разметке: адрес картинки не ждёт гидратации', () => {
      const markup = renderToStaticMarkup(createElement(Logo))
      const host = document.createElement('div')
      host.innerHTML = markup

      const img = host.querySelector('[data-header-logo-image] img')
      expect(img?.getAttribute('src')).toBe(HEADER_LOGO_WEB_SRC)
      expect(markup).toContain(`url(&quot;${HEADER_LOGO_WEB_SRC}&quot;)`)
    })
  })

  describe('скелетон-плашка', () => {
    it('анимируется правилом из таблицы стилей, а не мёртвым инлайн-свойством', () => {
      const markup = renderToStaticMarkup(createElement(SkeletonLoader, { width: '100%', height: 180 }))
      const node = toDom(markup)

      // RN-Web не компилирует animationKeyframes из инлайн-стиля: ключ уходил в DOM
      // как `animation-keyframes`, которого в CSS нет.
      expect(markup).not.toContain('animation-keyframes')

      const declarations = declarationsOf(node)
      const animationName = declarations.match(/animation-name:([^;]+);/)?.[1]
      expect(animationName).toBeTruthy()
      expect(declarations).toContain('animation-iteration-count:infinite')

      const sheet = StyleSheet.getSheet().textContent
      const keyframes = sheet.match(new RegExp(`@keyframes ${animationName}\\{(.*?\\})\\}`))?.[1]
      // Пульс по opacity считает композитор; сам кадр лежит во встроенной таблице
      // стилей документа и потому работает до гидратации.
      expect(keyframes).toContain('opacity:0.55')
    })
  })

  describe('каркас каталога квестов', () => {
    // Серверная разметка всегда узкая: ширины экрана на сервере нет. Каркас,
    // который выбирал бы колонки и высоту по признаку «телефон», на широком
    // экране перекладывался при гидратации (замер прода 05.10.2026: CLS 0,034
    // на 1280 и 0,057 на 1440). Поэтому геометрию считает CSS.
    it('одинаков до и после гидратации: колонки и высоту клетки задаёт CSS, а не ширина из JS', () => {
      const node = toDom(renderToStaticMarkup(createElement(QuestsGridSkeleton, { styles: {}, radius: 20 })))

      expect(node.getAttribute('data-testid')).toBe('quests-grid-skeleton')
      expect(declarationsOf(node)).toContain(
        'grid-template-columns:repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
      )
      const cells = Array.from(node.children)
      expect(cells).toHaveLength(6)
      for (const cell of cells) {
        expect(declarationsOf(cell)).toMatch(/aspect-ratio:1\.46\d*/)
        expect((cell as HTMLElement).style.height).toBe('')
      }
    })
  })
})
