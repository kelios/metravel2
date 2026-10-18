// #2473: текст перевода квеста на клиентском экране размечает цитаты-вывески
// языком оригинала, как SSG (#2472), и выводится только через QuestContentText.
import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'
import QuestContentText, { QuestContentLanguageProvider } from '@/components/quests/QuestContentText'

const fs = require('fs')
const path = require('path')

const originalOS = Platform.OS
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })

const renderInQuest = (text: string, contentLocale: string, countryCode?: string) =>
  render(
    <QuestContentLanguageProvider contentLocale={contentLocale} countryCode={countryCode}>
      <QuestContentText testID="content">{text}</QuestContentText>
    </QuestContentLanguageProvider>,
  )

const langParts = (tree: ReturnType<typeof render>) =>
  tree.UNSAFE_root.findAll((node) => typeof node.props.lang === 'string' && typeof node.type !== 'string')
    .map((node) => `${node.props.children}=${node.props.lang}`)

describe('QuestContentText', () => {
  afterEach(() => setOS(originalOS))

  it('на web кириллическая вывеска в PL/EN-тексте получает lang языка оригинала', () => {
    setOS('web')
    const pl = renderInQuest('Zajrzyj do kawiarni «Ландыш» przy placu.', 'pl', 'BY')
    expect(langParts(pl)).toEqual(['Ландыш=ru'])
    expect(pl.getByTestId('content')).toHaveTextContent('Zajrzyj do kawiarni «Ландыш» przy placu.')

    expect(langParts(renderInQuest('The «Лесвіца ў Падміколле» stairs.', 'en', 'BY'))).toEqual(['Лесвіца ў Падміколле=be'])
    expect(langParts(renderInQuest('Find «Львівська копальня кави».', 'en', 'UA'))).toEqual(['Львівська копальня кави=uk'])
  })

  it('кириллическая локаль контента и native не размечаются', () => {
    setOS('web')
    expect(langParts(renderInQuest('Кавярня «Ландыш»', 'be', 'BY'))).toEqual([])
    setOS('ios')
    const native = renderInQuest('Zajrzyj do kawiarni «Ландыш».', 'pl', 'BY')
    expect(langParts(native)).toEqual([])
    expect(native.getByTestId('content')).toHaveTextContent('Zajrzyj do kawiarni «Ландыш».')
  })
})

describe('текст квеста на экране выводится только через QuestContentText', () => {
  const QUEST_DIR = path.join(__dirname, '..', '..', '..', 'components', 'quests')
  const files = fs.readdirSync(QUEST_DIR).filter((name: string) => /^(QuestWizard|questWizard|QuestRouteStrip).*\.tsx$/.test(name))
  // `{step.story}</Text>` или `{ value1: step.hint })}</Text>`: поле контента шага,
  // финала или название квеста закрывается голым Text, а не QuestContentText.
  const BARE_CONTENT =
    /\{(?:[\w?.]+\.(?:title|location|story|task|hint|text)|title)\}\s*<\/Text>|value1: [\w?.]+\.(?:title|location|story|task|hint|text) \}\)\}\s*<\/Text>/g

  it.each(files)('%s', (name: string) => {
    const source = fs.readFileSync(path.join(QUEST_DIR, name), 'utf8')
    expect(source.match(BARE_CONTENT) || []).toEqual([])
  })
})
