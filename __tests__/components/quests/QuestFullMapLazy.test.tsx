jest.mock('@/components/quests/QuestFullMap', () => ({
  __esModule: true,
  default: function MockQuestFullMap() {
    return null
  },
}))

describe('QuestFullMapLazy platform wrappers', () => {
  it('keeps the web quest map lazily loaded', () => {
    const QuestFullMapLazy = require('@/components/quests/QuestFullMapLazy').default

    expect(typeof QuestFullMapLazy).toBe('object')
    expect(String(QuestFullMapLazy.$$typeof)).toContain('react.lazy')
  })

  it('uses a direct component on native so Android does not render the web loading placeholder forever', () => {
    const QuestFullMapLazy = require('@/components/quests/QuestFullMapLazy.native').default

    expect(typeof QuestFullMapLazy).toBe('function')
    expect(QuestFullMapLazy.name).toBe('MockQuestFullMap')
    expect(QuestFullMapLazy.$$typeof).toBeUndefined()
  })
})
