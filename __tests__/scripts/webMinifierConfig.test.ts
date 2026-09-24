const { applyWebBuildMinifier } = require('../../scripts/lib/webMinifierConfig')

describe('web minifier utf-8 (#2089)', () => {
  const transformer = {
    minifierConfig: {
      compress: { drop_console: true },
      output: { comments: false },
    },
  }

  it('leaves native and dev minifier defaults alone', () => {
    expect(applyWebBuildMinifier(transformer, {})).toBe(transformer)
    expect(applyWebBuildMinifier(transformer, { EXPO_WEB_BUILD_MINIFY: 'false' })).toBe(transformer)
  })

  it('turns ascii_only off only for the web production minify', () => {
    const next = applyWebBuildMinifier(transformer, { EXPO_WEB_BUILD_MINIFY: 'true' })
    expect(next.minifierConfig.output.ascii_only).toBe(false)
    expect(next.minifierConfig.output.comments).toBe(false)
    expect(next.minifierConfig.compress).toEqual({ drop_console: true })
    expect(transformer.minifierConfig.output.ascii_only).toBeUndefined()
  })
})
