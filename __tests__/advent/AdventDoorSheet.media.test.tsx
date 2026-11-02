import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import AdventDoorSheet from '@/components/advent/AdventDoorSheet'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { getAdventCampaign } from '@/services/advent/loadCampaign'

jest.mock('@/components/ui/BottomSheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement(View, null, children) : null
})
jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return (props: Record<string, unknown>) => React.createElement(View, props)
})

const doorWithImage = (image?: string, day = 1): AdventDoorView => {
  const door = getAdventCampaign().doors.find((candidate) => candidate.day === day)!
  return { ...door, state: 'opened', gift: { ...door.gift, image } }
}
const sheet = (door: AdventDoorView) => <AdventDoorSheet door={door} isAuthenticated={false} campaignYear={2026} onClose={jest.fn()} onCompleteTask={jest.fn()} />

describe('optional gift media in the real door sheet', () => {
  it.each([undefined, '', '   '])('omits the entire media frame for image=%p', async (image) => {
    const screen = await render(sheet(doorWithImage(image)))
    expect(screen.queryByTestId('advent-gift-media')).toBeNull()
    expect(screen.getByTestId('advent-door-sheet-1')).toBeTruthy()
    expect(screen.getByTestId('advent-guest-block')).toBeTruthy()
  })

  it('uses canonical contain media in a stable 16:9 frame and removes terminally failed media', async () => {
    const screen = await render(sheet(doorWithImage('https://example.com/real-gift.webp')))
    expect(StyleSheet.flatten(screen.getByTestId('advent-gift-media').props.style)).toMatchObject({ width: '100%', aspectRatio: 16 / 9 })
    expect(screen.getByTestId('advent-gift-image').props).toMatchObject({ src: 'https://example.com/real-gift.webp', fit: 'contain' })
    expect(screen.getByTestId('advent-gift-image').props.onError).toBeUndefined()
    await fireEvent(screen.getByTestId('advent-gift-image'), 'terminalError')
    expect(screen.queryByTestId('advent-gift-media')).toBeNull()
    expect(screen.getByTestId('advent-guest-block')).toBeTruthy()
  })

  it('recovers on a new image URL or door identity and keeps the gift actions', async () => {
    const screen = await render(sheet(doorWithImage('https://example.com/one.webp')))
    await fireEvent(screen.getByTestId('advent-gift-image'), 'terminalError')
    await screen.rerender(sheet(doorWithImage('https://example.com/two.webp')))
    expect(screen.getByTestId('advent-gift-image').props.src).toBe('https://example.com/two.webp')
    await fireEvent(screen.getByTestId('advent-gift-image'), 'terminalError')
    await screen.rerender(sheet(doorWithImage('https://example.com/two.webp', 2)))
    expect(screen.getByTestId('advent-gift-image').props.src).toBe('https://example.com/two.webp')
    expect(screen.getByTestId('advent-door-sheet-2')).toBeTruthy()
    expect(screen.getByTestId('advent-gift-link')).toBeTruthy()
  })
})
