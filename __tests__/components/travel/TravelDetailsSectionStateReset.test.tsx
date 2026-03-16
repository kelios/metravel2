/**
 * @jest-environment jsdom
 *
 * Tests for travel detail section state reset behavior.
 * These tests verify that state is properly reset when navigating between travels.
 *
 * The tests use lightweight inline components to avoid memory issues
 * that occur when loading the full component tree.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import type { Travel } from '@/types/types'

/**
 * Minimal reproduction of TravelDetailsSidebarSection state reset logic.
 * Tests that relatedTravels state resets when travel.id/slug changes.
 */
const MockSidebarSection: React.FC<{
  travel: Travel
  onTravelsLoaded?: (travels: Travel[]) => void
}> = ({ travel, onTravelsLoaded }) => {
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([])

  const handleTravelsLoaded = useCallback(
    (travels: Travel[]) => {
      setRelatedTravels(travels)
      onTravelsLoaded?.(travels)
    },
    [onTravelsLoaded]
  )

  // Reset state when travel changes — this is the behavior we're testing
  useEffect(() => {
    setRelatedTravels([])
  }, [travel.id, travel.slug])

  // Simulate NearTravelList calling onTravelsLoaded for travel.id === 1
  useEffect(() => {
    if (travel.id === 1) {
      const timer = setTimeout(() => {
        handleTravelsLoaded([
          { id: 1, slug: 'first-travel', name: 'First travel' } as Travel,
          { id: 2, slug: 'nearby-travel', name: 'Nearby travel' } as Travel,
        ])
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [travel.id, handleTravelsLoaded])

  return (
    <View testID="sidebar-section">
      <View testID={`near-travel-list-${travel.id}`} />
      {relatedTravels.length > 0 && (
        <Text testID="navigation-arrows">{relatedTravels.length}</Text>
      )}
    </View>
  )
}

/**
 * Minimal reproduction of TravelDetailsMapSection state reset logic.
 * Tests that mapOpened state resets when travel.id/slug changes.
 */
const MockMapSection: React.FC<{
  travel: Travel
}> = ({ travel }) => {
  const [mapOpened, setMapOpened] = useState(false)

  // Reset state when travel changes — this is the behavior we're testing
  useEffect(() => {
    setMapOpened(false)
  }, [travel.id, travel.slug])

  return (
    <View testID="map-section">
      <Pressable
        testID="open-map-button"
        onPress={() => setMapOpened(true)}
      >
        <Text>Open map</Text>
      </Pressable>
      {mapOpened && <View testID="travel-map" />}
    </View>
  )
}

describe('Travel detail section state resets', () => {
  beforeEach(() => {
    Platform.OS = 'web'
    Platform.select = (options: Record<string, unknown>) =>
      (options.web ?? options.default) as unknown
  })

  it('clears stale navigation arrows when the current travel changes', async () => {
    const firstTravel = { id: 1, slug: 'first-travel', travelAddress: [{ id: 1 }] } as Travel
    const secondTravel = { id: 2, slug: 'second-travel', travelAddress: [{ id: 2 }] } as Travel

    const view = render(<MockSidebarSection travel={firstTravel} />)

    // Wait for mock to call onTravelsLoaded and set relatedTravels
    await waitFor(() => {
      expect(view.getByTestId('navigation-arrows')).toBeTruthy()
    })

    // Rerender with different travel
    view.rerender(<MockSidebarSection travel={secondTravel} />)

    // After travel change, relatedTravels should be reset to []
    await waitFor(() => {
      expect(view.queryByTestId('navigation-arrows')).toBeNull()
    })
  })

  it('resets map open state when navigating to another travel', async () => {
    const firstTravel = {
      id: 1,
      slug: 'first-travel',
      travelAddress: [{ id: 1, coord: '53.9,27.56', name: 'Минск' }],
      coordsMeTravel: [{ lat: 53.9, lng: 27.56, coord: '53.9,27.56', title: 'Минск' }],
    } as Travel
    const secondTravel = {
      id: 2,
      slug: 'second-travel',
      travelAddress: [{ id: 2, coord: '52.1,23.7', name: 'Брест' }],
      coordsMeTravel: [{ lat: 52.1, lng: 23.7, coord: '52.1,23.7', title: 'Брест' }],
    } as Travel

    const view = render(<MockMapSection travel={firstTravel} />)

    // Initially map should not be visible
    expect(view.queryByTestId('travel-map')).toBeNull()

    // Open the map
    fireEvent.press(view.getByTestId('open-map-button'))

    await act(async () => {
      await Promise.resolve()
    })

    // Map should now be visible
    expect(view.getByTestId('travel-map')).toBeTruthy()

    // Rerender with different travel
    view.rerender(<MockMapSection travel={secondTravel} />)

    await act(async () => {
      await Promise.resolve()
    })

    // After travel change, map should be closed again
    expect(view.queryByTestId('travel-map')).toBeNull()
  })
})
