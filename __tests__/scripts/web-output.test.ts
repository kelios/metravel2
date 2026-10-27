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

  it('publishes production only from the server export and refuses a capability without the quest runtime (#2766)', () => {
    const { resolveDeployWebOutput } = require('@/scripts/lib/webOutput')
    const capability = { schema_version: 2, available: true, enabled: true, quest_web: quest }
    expect(resolveDeployWebOutput(capability)).toEqual({ output: 'server', questRuntime: true })
    // The static entity pipeline is gone and an SSR rollback returns the previous
    // SSR pair, so a disabled or article-only backend refuses instead of downgrading.
    expect(() => resolveDeployWebOutput({ schema_version: 2, available: false, enabled: false, quest_web: quest }))
      .toThrow('publishes only SSR')
    expect(() => resolveDeployWebOutput({ schema_version: 1, available: true, enabled: true }))
      .toThrow('publishes only SSR')
    expect(() => resolveDeployWebOutput({ schema_version: 2, available: true, enabled: true })).toThrow('quest SSR capability')
    expect(require('@/scripts/lib/webOutput')).not.toHaveProperty('WEB_SSR_ROLLOUT_ENABLED')
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
