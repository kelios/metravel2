/** @jest-environment node */
const { resolveWebSsrCapability, resolveWebOutput, getQuestControlPath } = require('@/scripts/lib/webOutput')

describe('backend SSR capability', () => {
  const quest = { schema_version: 2, builder_schema: 2, refresh_max_age_seconds: 30 }

  it('cannot compile quest loaders into a static client without loader endpoints', () => {
    expect(() => resolveWebOutput({ METRAVEL_WEB_OUTPUT: 'static', EXPO_PUBLIC_WEB_RUNTIME_SSR: 'false', EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true' }))
      .toThrow('Quest runtime requires server output')
    expect(resolveWebOutput({ METRAVEL_WEB_OUTPUT: 'server', EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true', EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true' }))
      .toBe('server')
  })

  it('retains article-only runtime support from the installed v1 backend', () => {
    expect(resolveWebSsrCapability({ schema_version: 1, available: true, enabled: true }))
      .toEqual({ output: 'server', questRuntime: false })
    expect(resolveWebSsrCapability({ schema_version: 1, available: false, enabled: false }))
      .toEqual({ output: 'static', questRuntime: false })
  })

  it('enables quest loaders only with the reviewed v2 builder and freshness contract', () => {
    expect(resolveWebSsrCapability({ schema_version: 2, available: true, enabled: true, quest_web: quest }))
      .toEqual({ output: 'server', questRuntime: true })
  })

  it('serves production from the server export only through the committed rollout switch', () => {
    const { WEB_SSR_ROLLOUT_ENABLED, resolveDeployWebOutput } = require('@/scripts/lib/webOutput')
    const capability = { schema_version: 2, available: true, enabled: true, quest_web: quest }
    // Switched on by the owner on 27.10.2026 (#2768) after local hydration of
    // the home page, quests and articles at 390/768/1440; on again once the
    // quest refresher fit its memory limit (#2771).
    expect(WEB_SSR_ROLLOUT_ENABLED).toBe(true)
    expect(resolveDeployWebOutput(capability)).toEqual({ output: 'server', questRuntime: true })
    expect(resolveDeployWebOutput(capability, false)).toEqual({ output: 'static', questRuntime: false })
    expect(resolveDeployWebOutput({ schema_version: 2, available: false, enabled: false, quest_web: quest }))
      .toEqual({ output: 'static', questRuntime: false })
    expect(() => resolveDeployWebOutput({ schema_version: 2, available: true, enabled: true })).toThrow('quest SSR capability')
  })

  it('uses only a canonical public control selected by the activated backend generation', () => {
    const capability = { schema_version: 2, available: true, enabled: true, quest_web: { ...quest, control_path: '/pl/quests/17/demo' } }
    expect(getQuestControlPath(capability)).toBe('/pl/quests/17/demo')
    expect(() => getQuestControlPath({ ...capability, quest_web: { ...quest, control_path: 'https://other.example/quests/17/demo' } })).toThrow()
    expect(() => getQuestControlPath({ ...capability, quest_web: quest })).toThrow()
  })

  it.each([
    null,
    { schema_version: 3, available: true, enabled: true },
    { schema_version: 1, available: false, enabled: true },
    { schema_version: 2, available: true, enabled: true },
    { schema_version: 2, available: true, enabled: true, quest_web: { ...quest, refresh_max_age_seconds: 31 } },
    { schema_version: 2, available: true, enabled: true, quest_web: { ...quest, builder_schema: 1 } },
  ])('fails closed instead of downgrading malformed deployed capability %p', (value) => {
    expect(() => resolveWebSsrCapability(value)).toThrow()
  })
})
