import React from 'react'
import { Platform } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'
// The native Jest resolver otherwise picks QuestFullMap.native.tsx.
const QuestFullMap = require('@/components/quests/QuestFullMap.tsx').default

jest.mock('@/hooks/useQuestContentLocale', () => ({ useQuestContentLocale: () => 'pl' }))
jest.mock('@/components/quests/useQuestRouteGeometry', () => ({
  useQuestRouteGeometry: () => ({ status: 'fallback', source: 'fallback', track: [], distanceM: 0 }),
  hasRoutedQuestTrack: () => false,
}))
jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: ({ children }: { children: () => React.ReactNode }) => <>{children()}</>,
}))
jest.mock('@/utils/loadLeafletRuntime', () => {
  const Group = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return {
    loadLeafletRuntime: async () => ({
      L: { divIcon: jest.fn() },
      RL: { Marker: Group, Popup: Group, FeatureGroup: Group, Polyline: () => null, useMap: () => null },
    }),
  }
})

it('#2482 marks map popup step titles and the toolbar quest title', async () => {
  const originalOS = Platform.OS
  Platform.OS = 'web'
  try {
    const tree = render(<QuestFullMap title="Тайны дворца" steps={[{ lat: 53, lng: 27, title: 'Лесвіца ў Падміколле' }]} />)
    await waitFor(() => expect(tree.getByText('Тайны дворца')).toBeTruthy())
    const marked = tree.UNSAFE_root.findAll((node) => typeof node.props.lang === 'string')
    expect(marked.some((node) => node.props.lang === 'ru' && node.props.children === 'Тайны дворца')).toBe(true)
    expect(marked.some((node) => node.props.lang === 'be' && node.props.children === 'Лесвіца ў Падміколле')).toBe(true)
  } finally { Platform.OS = originalOS }
})
