import React from 'react'
import { render } from '@testing-library/react-native'

import type { CharacterState } from '@/api/gamification'

let mockIsAuthenticated = true

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}))

const mockUseMyCharacter = jest.fn()
const mockUseUserCharacter = jest.fn()

jest.mock('@/hooks/useGamification', () => ({
  useMyCharacter: (...args: unknown[]) => mockUseMyCharacter(...args),
  useUserCharacter: (...args: unknown[]) => mockUseUserCharacter(...args),
}))

jest.mock('@/utils/gamificationAnalytics', () => ({
  trackCharacterBlockViewed: jest.fn(),
}))

import CharacterProfileCard from '@/components/achievements/CharacterProfileCard'

const buildCharacter = (overrides: Partial<CharacterState> = {}): CharacterState => ({
  id: 1,
  name: 'Персонаж',
  level: 1,
  pathSlug: null,
  pathName: null,
  activePathSlug: null,
  suggestedPathSlug: null,
  switchUnlocked: false,
  details: [],
  pendingChoice: false,
  pathOptions: [],
  updatedAt: null,
  ...overrides,
})

const queryResult = (data: CharacterState | undefined, opts: { isFetching?: boolean; isError?: boolean } = {}) => ({
  data,
  isFetching: opts.isFetching ?? false,
  isError: opts.isError ?? false,
})

describe('CharacterProfileCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthenticated = true
    mockUseUserCharacter.mockReturnValue(queryResult(undefined))
  })

  it('own profile: shows static title and branch name inside meta, not as raw heading', () => {
    const character = buildCharacter({
      name: 'Лисья',
      pathName: null,
      level: 4,
      pathSlug: 'fox',
    })
    mockUseMyCharacter.mockReturnValue(queryResult(character))

    const { getByText, queryByText } = render(<CharacterProfileCard />)

    expect(getByText('Ваш персонаж')).toBeTruthy()
    expect(getByText(/Ветка «Лисья»/)).toBeTruthy()
    expect(getByText(/уровень 4/)).toBeTruthy()
    // «Лисья» существует только внутри строки "Ветка «Лисья»", не как отдельный узел.
    expect(queryByText('Лисья')).toBeNull()
  })

  it('public profile: shows generic traveler title', () => {
    const character = buildCharacter({
      name: 'Собачья',
      pathName: 'Собачья',
      level: 2,
      pathSlug: 'dog',
    })
    mockUseMyCharacter.mockReturnValue(queryResult(undefined))
    mockUseUserCharacter.mockReturnValue(queryResult(character))

    const { getByText, queryByText } = render(<CharacterProfileCard userId={42} />)

    expect(getByText('Персонаж путешественника')).toBeTruthy()
    expect(queryByText('Ваш персонаж')).toBeNull()
    expect(getByText(/Ветка «Собачья»/)).toBeTruthy()
    expect(getByText(/уровень 2/)).toBeTruthy()
  })

  it('does not show a "Ветка" fragment when name/pathName is the default placeholder', () => {
    const character = buildCharacter({
      name: 'Персонаж',
      pathName: null,
      level: 1,
    })
    mockUseMyCharacter.mockReturnValue(queryResult(character))

    const { getByText, queryByText } = render(<CharacterProfileCard />)

    expect(getByText('Ваш персонаж')).toBeTruthy()
    expect(queryByText(/Ветка/)).toBeNull()
    expect(getByText(/уровень 1/)).toBeTruthy()
  })
})
