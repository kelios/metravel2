import { render } from '@testing-library/react-native'

import AdventGameShare from '@/components/advent/tasks/AdventGameShare'

const mockUseShare = jest.fn()
jest.mock('@/components/advent/useAdventCardShare', () => ({
  useAdventCardShare: (params: unknown) => {
    mockUseShare(params)
    return { status: 'idle', canDownload: false, share: jest.fn(), download: jest.fn() }
  },
}))

const props = {
  year: 2026, title: 'Легенда дорог', subtitle: 'Моё звание',
  shareLabel: 'Поделиться', shareText: 'Моё звание', filename: 'title.png', testIDPrefix: 'title',
}

it.each(['departure', 'lanterns', 'trail', 'rail'])('selects %s by earned tier rank, independently of its translated title', async (art) => {
  const titleRank = ['departure', 'lanterns', 'trail', 'rail'].indexOf(art)
  await render(<AdventGameShare {...props} title="Legenda dróg" kind="title" titleRank={titleRank} />)
  const params = mockUseShare.mock.calls.at(-1)![0]
  expect(params.titleArtwork).toBe(art)
  expect(params.buildSpec()).toMatchObject({ title: 'Legenda dróg', subtitle: 'Моё звание', house: undefined })
})

it('keeps fortune postcards on their existing house illustration', async () => {
  await render(<AdventGameShare {...props} kind="fortune" />)
  const params = mockUseShare.mock.calls.at(-1)![0]
  expect(params.titleArtwork).toBeUndefined()
  expect(params.buildSpec().house).toEqual({ lit: 24 })
})
