import {
  QUEST_RESULT_UTM_MEDIUM,
  QUEST_RESULT_UTM_SOURCE,
  buildQuestPublicUrl,
  buildQuestResultShareLink,
  buildQuestResultShareUtm,
} from '@/utils/questResultShare'

// Регресс-контроль вирусной петли ([INV2-02], #1472): фиксирует UTM-контракт
// результата квеста. Именно на `utm_medium=quest_result` завязана валидация
// задачи (визиты по расшаренному диплому видны в аналитике), поэтому молчаливая
// смена метки будущей правкой должна ронять тест, а не аналитику.
describe('utils/questResultShare', () => {
  it('uses the fixed source/medium mandated by the task', () => {
    expect(QUEST_RESULT_UTM_SOURCE).toBe('share')
    expect(QUEST_RESULT_UTM_MEDIUM).toBe('quest_result')
  })

  it('builds the UTM object with a per-quest campaign', () => {
    expect(buildQuestResultShareUtm('minsk-cipher')).toEqual({
      source: 'share',
      medium: 'quest_result',
      campaign: 'quest_minsk-cipher',
    })
  })

  it('appends utm_source=share and utm_medium=quest_result to the link', () => {
    const link = buildQuestResultShareLink('https://metravel.by/quests/result/42', {
      slug: 'minsk-cipher',
    })
    expect(link).toContain('utm_source=share')
    expect(link).toContain('utm_medium=quest_result')
    expect(link).toContain('utm_campaign=quest_minsk-cipher')
  })

  it('preserves an existing query and hash without duplicating UTM', () => {
    const link = buildQuestResultShareLink(
      'https://metravel.by/quests/result/42?ref=x#section',
      { slug: 'x' },
    )
    expect(link).toBe(
      'https://metravel.by/quests/result/42?ref=x&utm_source=share&utm_medium=quest_result&utm_campaign=quest_x#section',
    )
  })

  it('does not overwrite UTM already present on the URL', () => {
    const link = buildQuestResultShareLink(
      'https://metravel.by/quests/result/42?utm_source=partner',
      { slug: 'x' },
    )
    expect(link).toContain('utm_source=partner')
    expect(link).not.toContain('utm_source=share')
  })

  it('does not mistake query-like hash content for an existing UTM', () => {
    const link = buildQuestResultShareLink(
      'https://metravel.by/quests/result/42#?utm_source=fragment',
      { slug: 'x' },
    )
    expect(link).toContain('?utm_source=share')
    expect(link).toContain('#?utm_source=fragment')
  })

  it('returns the URL untouched when empty', () => {
    expect(buildQuestResultShareLink('', { slug: 'x' })).toBe('')
  })

  it('builds the quest canonical URL as a share fallback', () => {
    const url = buildQuestPublicUrl('minsk', 'minsk-cipher')
    expect(url).toMatch(/^https?:\/\//)
    expect(url).toContain('/quests/minsk/minsk-cipher')
  })

  it('falls back to the quests listing when city or slug is missing', () => {
    expect(buildQuestPublicUrl(undefined, 'x')).toContain('/quests')
    expect(buildQuestPublicUrl('minsk', undefined)).toContain('/quests')
  })
})
