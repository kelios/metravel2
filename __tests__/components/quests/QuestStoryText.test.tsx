/**
 * #3220, owner decision 09.11.2026: a long point story on a phone opens with its
 * first lines so the task and the answer field fit the first screen. The clamp
 * is visual — the full text stays rendered; short stories and desktop are untouched.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockResponsive = { isMobile: true }
jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => mockResponsive }))

import QuestStoryText, { QUEST_STORY_COLLAPSE, shouldCollapseQuestStory } from '@/components/quests/QuestStoryText'

const LONG = 'Коложская церковь стоит над Неманом с 1180-х годов. '.repeat(12)
const SHORT = 'Короткая история точки.'

describe('QuestStoryText (#3220)', () => {
  beforeEach(() => { mockResponsive.isMobile = true })

  it('collapses a long story to its first lines and expands it with an accessible toggle', async () => {
    const view = await render(<QuestStoryText story={LONG} style={undefined} collapsible />)
    const story = view.getByTestId('quest-step-story')
    expect(story.props.numberOfLines).toBe(QUEST_STORY_COLLAPSE.lines)
    expect(story).toHaveTextContent(LONG.trim())
    const toggle = view.getByTestId('quest-step-story-toggle')
    expect(toggle.props.accessibilityRole).toBe('button')
    expect(toggle.props.accessibilityState).toEqual({ expanded: false })
    expect(view.getByText('Читать дальше')).toBeTruthy()
    await fireEvent.press(toggle)
    expect(view.getByTestId('quest-step-story').props.numberOfLines).toBeUndefined()
    expect(view.getByTestId('quest-step-story-toggle').props.accessibilityState).toEqual({ expanded: true })
    expect(view.getByText('Свернуть')).toBeTruthy()
  })

  it('keeps a short story whole, without a toggle', async () => {
    const view = await render(<QuestStoryText story={SHORT} style={undefined} collapsible />)
    expect(view.getByTestId('quest-step-story').props.numberOfLines).toBeUndefined()
    expect(view.queryByTestId('quest-step-story-toggle')).toBeNull()
  })

  it('does not collapse on desktop or for the intro card', async () => {
    mockResponsive.isMobile = false
    const desktop = await render(<QuestStoryText story={LONG} style={undefined} collapsible />)
    expect(desktop.queryByTestId('quest-step-story-toggle')).toBeNull()
    mockResponsive.isMobile = true
    const intro = await render(<QuestStoryText story={LONG} style={undefined} collapsible={false} />)
    expect(intro.queryByTestId('quest-step-story-toggle')).toBeNull()
    expect(shouldCollapseQuestStory('x'.repeat(QUEST_STORY_COLLAPSE.minChars), true)).toBe(false)
    expect(shouldCollapseQuestStory('x'.repeat(QUEST_STORY_COLLAPSE.minChars + 1), true)).toBe(true)
  })
})
