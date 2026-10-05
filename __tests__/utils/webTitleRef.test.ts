import { Platform } from 'react-native'

import { applyWebTitle, webTitleRef } from '@/utils/webProps'

// #2261: сам сеттер и native-ветка. То, что атрибут доходит до страницы, проверяет
// `webTitleRef.dom.web.test.tsx` на настоящем react-native-web.
describe('webTitleRef / applyWebTitle', () => {
  const originalOS = Platform.OS
  const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os })

  afterEach(() => setOS(originalOS))

  const makeNode = () => ({ setAttribute: jest.fn(), removeAttribute: jest.fn() })

  it('writes the title and nothing else', () => {
    const node = makeNode()
    applyWebTitle(node, 'Открыть в Google Maps')

    expect(node.setAttribute.mock.calls).toEqual([['title', 'Открыть в Google Maps']])
    expect(node.removeAttribute).not.toHaveBeenCalled()
  })

  it.each(['', null, undefined])('removes the title for empty text (%p)', (text) => {
    const node = makeNode()
    applyWebTitle(node, text)

    expect(node.removeAttribute.mock.calls).toEqual([['title']])
    expect(node.setAttribute).not.toHaveBeenCalled()
  })

  it('ignores a detached ref and a node without DOM methods', () => {
    expect(() => applyWebTitle(null, 'x')).not.toThrow()
    expect(() => applyWebTitle({ _nativeTag: 7 }, 'x')).not.toThrow()
  })

  it('on web returns a ref that sets the attribute; React detaching it (null) is a no-op', () => {
    setOS('web')
    const node = makeNode()
    const ref = webTitleRef('Ещё действия')

    ref?.(node)
    ref?.(null)

    expect(node.setAttribute.mock.calls).toEqual([['title', 'Ещё действия']])
    expect(node.removeAttribute).not.toHaveBeenCalled()
  })

  it.each(['ios', 'android'])('on %s returns no ref at all', (os) => {
    setOS(os)
    expect(webTitleRef('Ещё действия')).toBeUndefined()
    expect(webTitleRef('')).toBeUndefined()
  })
})
