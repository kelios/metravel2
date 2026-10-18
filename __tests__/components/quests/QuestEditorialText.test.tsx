import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'
import QuestEditorialText from '@/components/quests/QuestEditorialText'
import { QuestContentLanguageProvider } from '@/components/quests/QuestContentText'

let mockLocale = 'pl'
jest.mock('@/hooks/useQuestContentLocale', () => ({ useQuestContentLocale: () => mockLocale }))

const markedParts = (tree: ReturnType<typeof render>) => tree.UNSAFE_root
  .findAll((node) => typeof node.props.lang === 'string' && typeof node.type !== 'string')
  .map((node) => [node.props.children, node.props.lang])

describe('#2482 editorial text outside the quest bundle language', () => {
  const originalOS = Platform.OS
  beforeEach(() => { Platform.OS = 'web'; mockLocale = 'pl' })
  afterEach(() => { Platform.OS = originalOS })

  it.each(['pl', 'en'])('classifies original Cyrillic text on %s pages without translating it', (locale) => {
    mockLocale = locale
    const tree = render(<QuestEditorialText testID="editorial">{'Walk: Озёра Лепельщины · Лесвіца ў Падміколле · Львівська копальня кави'}</QuestEditorialText>)
    expect(markedParts(tree)).toEqual([
      ['Озёра Лепельщины', 'ru'], ['Лесвіца ў Падміколле', 'be'], ['Львівська копальня кави', 'uk'],
    ])
    expect(tree.getByTestId('editorial')).toHaveTextContent('Walk: Озёра Лепельщины · Лесвіца ў Падміколле · Львівська копальня кави')
  })

  it('follows page locale even inside a Russian fallback quest provider, and updates on locale switch', () => {
    const content = <QuestContentLanguageProvider contentLocale="ru" countryCode="UA"><QuestEditorialText>Беларусь</QuestEditorialText></QuestContentLanguageProvider>
    const tree = render(content)
    expect(markedParts(tree)).toEqual([['Беларусь', 'ru']])
    mockLocale = 'ru'
    tree.rerender(<QuestContentLanguageProvider contentLocale="ru" countryCode="UA"><QuestEditorialText>Беларусь</QuestEditorialText></QuestContentLanguageProvider>)
    expect(markedParts(tree)).toEqual([])
  })

  it.each(['ios', 'android'])('preserves native rendering on %s', (platform) => {
    Platform.OS = platform as typeof Platform.OS
    const tree = render(<QuestEditorialText testID="editorial">Беларусь</QuestEditorialText>)
    expect(markedParts(tree)).toEqual([])
    expect(tree.getByTestId('editorial')).toHaveTextContent('Беларусь')
  })
})
