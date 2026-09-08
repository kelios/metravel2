import { render } from '@testing-library/react'
import { Platform } from 'react-native'

import { SafeHtml } from '@/components/article/SafeHtml'
import { typographyStyles } from '@/components/travel/stableContent/webStyles/typography'
import { useThemedColors } from '@/hooks/useTheme'

const FORMATTED = '<h2 class="ql-align-center">Заголовок</h2>' +
  '<p class="ql-align-right ql-indent-4"><span class="ql-font-serif ql-size-large">Текст</span></p>' +
  '<p class="ql-align-justify"><span class="ql-font-monospace ql-size-small">Код</span></p>'

describe('reader Quill formatting styles', () => {
  const originalOS = Platform.OS
  beforeEach(() => { Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true }) })
  afterEach(() => { Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }) })

  const expectFormatting = (root: Element) => {
    expect(getComputedStyle(root.querySelector('h2')!).textAlign).toBe('center')
    expect(getComputedStyle(root.querySelector('.ql-align-right')!).textAlign).toBe('right')
    expect(getComputedStyle(root.querySelector('.ql-align-justify')!).textAlign).toBe('justify')
    expect(getComputedStyle(root.querySelector('.ql-font-serif')!).fontFamily).toContain('serif')
    expect(getComputedStyle(root.querySelector('.ql-font-monospace')!).fontFamily).toContain('monospace')
    expect(getComputedStyle(root.querySelector('.ql-size-large')!).fontSize).toBe('1.5em')
    expect(getComputedStyle(root.querySelector('.ql-size-small')!).fontSize).toBe('0.75em')
    expect(getComputedStyle(root.querySelector('.ql-indent-4')!).marginLeft).toBe('6em')
  }

  it.each([true, false])('SafeHtml styles serverSanitized=%s content', (serverSanitized) => {
    const { container } = render(<SafeHtml html={FORMATTED} serverSanitized={serverSanitized} />)
    expectFormatting(container)
  })

  it('travel typography applies the same scoped formatting without styling outside content', () => {
    function TypographyFixture() {
      const colors = useThemedColors()
      return <>
        <style>{typographyStyles(colors, 'article-test')}</style>
        <div className="article-test" dangerouslySetInnerHTML={{ __html: FORMATTED }} />
        <p data-testid="outside" className="ql-align-center">Снаружи</p>
      </>
    }
    const { container, getByTestId } = render(<TypographyFixture />)
    expectFormatting(container.querySelector('.article-test')!)
    expect(getComputedStyle(getByTestId('outside')).textAlign).not.toBe('center')
  })
})
