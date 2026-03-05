describe('patchWebShadowStyles', () => {
  const patchFlag = '__metravel_web_shadow_patch_v1__'

  beforeEach(() => {
    jest.resetModules()
    delete (globalThis as Record<string, unknown>)[patchFlag]
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[patchFlag]
    jest.dontMock('react-native')
  })

  it('converts deprecated textShadow* props to textShadow on web', async () => {
    const createMock = jest.fn((styles) => styles)
    const flattenMock = jest.fn((style) => style)

    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
      StyleSheet: {
        create: createMock,
        flatten: flattenMock,
      },
    }))

    const { patchWebShadowStyles } = await import('@/utils/patchWebShadowStyles')
    const { StyleSheet } = await import('react-native')

    patchWebShadowStyles()

    const styles = StyleSheet.create({
      title: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    })

    expect(styles.title.textShadow).toBe('0px 1px 2px rgba(0,0,0,0.5)')
    expect(styles.title.textShadowColor).toBeUndefined()
    expect(styles.title.textShadowOffset).toBeUndefined()
    expect(styles.title.textShadowRadius).toBeUndefined()
  })

  it('keeps explicit textShadow value when it is already provided', async () => {
    const createMock = jest.fn((styles) => styles)
    const flattenMock = jest.fn((style) => style)

    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
      StyleSheet: {
        create: createMock,
        flatten: flattenMock,
      },
    }))

    const { patchWebShadowStyles } = await import('@/utils/patchWebShadowStyles')
    const { StyleSheet } = await import('react-native')

    patchWebShadowStyles()

    const styles = StyleSheet.create({
      title: {
        textShadow: '1px 2px 3px red',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    })

    expect(styles.title.textShadow).toBe('1px 2px 3px red')
    expect(styles.title.textShadowColor).toBeUndefined()
    expect(styles.title.textShadowOffset).toBeUndefined()
    expect(styles.title.textShadowRadius).toBeUndefined()
  })
})
