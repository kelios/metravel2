import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'

import RoutePointEditForm from '@/components/trips/planning/RoutePointEditForm'
import { createStyles } from '@/components/trips/planning/RouteBuilder.styles'
import { EMPTY_OVERNIGHT_BOOKING_DRAFT } from '@/components/trips/planning/routeOvernightBooking'
import { scrollPlannerNodeIntoView } from '@/components/trips/planning/scrollPlannerNodeIntoView'
import type { ThemedColors } from '@/hooks/useTheme'

jest.mock('@/components/trips/planning/scrollPlannerNodeIntoView', () => ({
  scrollPlannerNodeIntoView: jest.fn(),
}))

jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch() {
    return null
  }
})

jest.mock('@/components/trips/planning/RouteDayField', () => {
  return function RouteDayField() {
    return null
  }
})

const colors = new Proxy({}, { get: (_target, key) => String(key) }) as ThemedColors
const originalOS = Platform.OS

const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })
}

const renderForm = (isMapFirst: boolean, editingIndex = 0) =>
  render(
    <RoutePointEditForm
      styles={createStyles(colors)}
      colors={colors}
      isMapFirst={isMapFirst}
      editingIndex={editingIndex}
      routeLength={3}
      typeOptions={['custom']}
      type="custom"
      name="Точка"
      lat="53.9"
      lng="27.56"
      description=""
      booking={EMPTY_OVERNIGHT_BOOKING_DRAFT}
      dayNumber=""
      arrival={{ value: null, onChange: jest.fn() }}
      dayChips={[]}
      error={null}
      onTypeChange={jest.fn()}
      onBookingChange={jest.fn()}
      onDayNumberChange={jest.fn()}
      onAddressSelect={jest.fn()}
      onNameChange={jest.fn()}
      onLatChange={jest.fn()}
      onLngChange={jest.fn()}
      onDescriptionChange={jest.fn()}
      onSave={jest.fn()}
      onCancel={jest.fn()}
      onMove={jest.fn()}
      onDelete={jest.fn()}
    />,
  )

describe('RoutePointEditForm desktop scroll (#1974)', () => {
  beforeEach(() => {
    setPlatformOS('web')
    jest.mocked(scrollPlannerNodeIntoView).mockClear()
  })
  afterAll(() => setPlatformOS(originalOS))

  it('scrolls the top of the form into view on the desktop stack layout', () => {
    renderForm(false)

    expect(scrollPlannerNodeIntoView).toHaveBeenCalledWith(
      expect.anything(),
      { block: 'start', behavior: 'smooth' },
    )
  })

  it('does not scroll from the form itself in the compact mapFirst layout', () => {
    renderForm(true)

    expect(scrollPlannerNodeIntoView).not.toHaveBeenCalled()
  })
})
