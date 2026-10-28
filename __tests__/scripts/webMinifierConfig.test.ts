const vm = require('node:vm')
const { parse } = require('@babel/parser')
const generate = require('@babel/generator').default
const { normalizePseudoGlobals } = require('metro-transform-plugins')
const minifier = require('metro-minify-terser')
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
    expect(next.unstable_disableNormalizePseudoGlobals).toBe(true)
    expect(next.minifierConfig.output.comments).toBe(false)
    expect(next.minifierConfig.compress).toEqual({ drop_console: true })
    expect(transformer.minifierConfig.output.ascii_only).toBeUndefined()
  })
})

it('preserves the installed Metro factory ABI, getters and import side effects for native and web', async () => {
  const defaults = require('metro-config/private/defaults/index').default.getDefaultValues(process.cwd()).transformer
  const web = applyWebBuildMinifier(defaults, { EXPO_WEB_BUILD_MINIFY: 'true' })
  expect(web.minifierConfig.compress).toEqual(defaults.minifierConfig.compress)
  expect(web.minifierConfig.compress.reduce_funcs).toBe(false)
  const source = `__d(function(global, require, _importDefault, _importAll, module, exports, _dependencyMap) {
    const dependency = require(_dependencyMap[0]);
    exports.marker = 'initial exports';
    module.exports = {
      run(value) { return dependency.run(value) + global.offset; },
      get label() { return dependency.label; },
      defaultValue: _importDefault(_dependencyMap[0]),
      namespaceValue: _importAll(_dependencyMap[1]),
      initialExports: exports,
      current() { return module.exports; }
    };
  });`

  const cases = [
    { transformer: defaults, reservedCount: 7 },
    { transformer: web, reservedCount: 0 },
    { transformer: { ...web, unstable_dependencyMapReservedName: '_dependencyMap' }, reservedCount: 1 },
  ]
  for (const { transformer, reservedCount } of cases) {
    const ast = parse(source)
    const reserved = transformer.unstable_dependencyMapReservedName ? [transformer.unstable_dependencyMapReservedName] : []
    if (!transformer.unstable_disableNormalizePseudoGlobals) {
      reserved.push(...normalizePseudoGlobals(ast, { reservedNames: reserved }))
    }
    expect(reserved).toHaveLength(reservedCount)
    const compiled = await minifier({ code: generate(ast).code, filename: 'factory.js', reserved, config: transformer.minifierConfig })
    let factory: (...args: unknown[]) => void = () => { throw new Error('Factory was not registered') }
    vm.runInNewContext(compiled.code, { __d: (value: typeof factory) => { factory = value } })

    const calls: Array<[string, unknown]> = []
    let reads = 0
    const dependency = { run: (value: number) => value * 2, get label() { reads++; return 'live' } }
    const initialExports = {} as { marker: string }
    const module = { exports: initialExports as unknown as {
      run: (value: number) => number; label: string; defaultValue: string; namespaceValue: string;
      initialExports: typeof initialExports; current: () => unknown;
    } }
    factory({ offset: 3 }, (id: number) => { calls.push(['require', id]); return dependency },
      (id: number) => { calls.push(['default', id]); return 'default' },
      (id: number) => { calls.push(['namespace', id]); return 'namespace' }, module, initialExports, [17, 19])

    expect(module.exports.run(4)).toBe(11)
    expect(module.exports.label).toBe('live')
    expect(module.exports.label).toBe('live')
    expect(reads).toBe(2)
    expect(module.exports.defaultValue).toBe('default')
    expect(module.exports.namespaceValue).toBe('namespace')
    expect(module.exports.initialExports).toBe(initialExports)
    expect(initialExports.marker).toBe('initial exports')
    expect(module.exports.current()).toBe(module.exports)
    expect(calls).toEqual([['require', 17], ['default', 17], ['namespace', 19]])
  }
})
