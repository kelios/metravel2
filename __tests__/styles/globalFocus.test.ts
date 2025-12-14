import { Platform } from 'react-native'

describe('globalFocus styles', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.resetModules()
    document.head.innerHTML = ''
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('injects web focus helpers and merges styles', () => {
    jest.isolateModules(() => {
      const rn = require('react-native')
      ;(rn.Platform as any).OS = 'web'
      const { applyFocusStyles } = require('@/styles/globalFocus')

      const styleTags = Array.from(document.head.querySelectorAll('style'))
      expect(styleTags.some((tag) => tag.textContent?.includes('.focusable'))).toBe(true)

      const combined = applyFocusStyles({ padding: 4 }, 'strong')
      expect(combined).toHaveLength(2)
    })
  })

  it('skips style injection outside web', () => {
    jest.isolateModules(() => {
      const rn = require('react-native')
      ;(rn.Platform as any).OS = 'ios'
      require('@/styles/globalFocus')
    })

    expect(document.head.querySelectorAll('style').length).toBe(0)
  })
})
