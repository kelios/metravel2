const {
  countAuthorPublications,
  buildPublishFunnelAlert,
} = require('../../scripts/lib/publishFunnelHealth')

const window = { startDate: '2026-10-01', endDate: '2026-10-30' }

describe('publishFunnelHealth (#2908)', () => {
  it('counts non-owner publications in the window and drops bulk days', () => {
    const travels = [
      { id: 1, published_at: '2026-10-02T10:00:00Z', userIds: [14] },
      { id: 2, published_at: '2026-10-03T10:00:00Z', userIds: '9' },
      { id: 3, published_at: '2026-10-03T11:00:00Z', userIds: [1, 9] },
      { id: 7, published_at: '2026-10-04T11:00:00Z', userIds: ' 01 ' },
      { id: 8, published_at: '2026-10-04T12:00:00Z', userIds: 'abc' },
      { id: 4, published_at: '2026-09-30T23:00:00Z', userIds: [14] },
      { id: 5, published_at: null, userIds: [14] },
      { id: 6, published_at: '2026-10-05T10:00:00Z', user: { id: 33 } },
      ...Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, published_at: '2026-10-18T09:00:00Z', userIds: [14] })),
    ]
    expect(countAuthorPublications(travels, window)).toEqual({
      count: 3,
      bulkDays: [{ day: '2026-10-18', count: 12 }],
    })
  })

  it('alerts only on a real gap: enough publications and no publish events at all', () => {
    expect(buildPublishFunnelAlert({ gaPublishEvents: 0, gaPublishAttempts: 0, apiPublications: 2, windowDays: 30 })).toBeNull()
    expect(buildPublishFunnelAlert({ gaPublishEvents: 0, gaPublishAttempts: 1, apiPublications: 9, windowDays: 30 })).toBeNull()
    expect(buildPublishFunnelAlert({ gaPublishEvents: 1, gaPublishAttempts: 0, apiPublications: 9, windowDays: 30 })).toBeNull()
    expect(buildPublishFunnelAlert({ gaPublishEvents: 0, gaPublishAttempts: 0, apiPublications: 3, windowDays: 30 }))
      .toMatch(/travel_publish = 0 .* 3 approved non-owner publications/)
  })
})
