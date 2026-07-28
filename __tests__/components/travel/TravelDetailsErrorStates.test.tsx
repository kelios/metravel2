import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { LoadError } from '@/components/travel/details/TravelDetailsErrorStates'

const styles = {
  safeArea: {},
  errorContainer: {},
  errorTitle: {},
  errorText: {},
  errorButton: {},
  errorButtonText: {},
}

describe('TravelDetailsErrorStates', () => {
  it('routes an unsaved offline travel to the saved-content library', () => {
    const onOpenSaved = jest.fn()
    const screen = render(
      <LoadError
        styles={styles}
        seoBlock={null}
        errorMessage="OFFLINE_CONTENT_NOT_SAVED"
        onRetry={jest.fn()}
        onGoHome={jest.fn()}
        onOpenSaved={onOpenSaved}
      />,
    )

    expect(screen.getByText('Этот материал не сохранён')).toBeTruthy()
    fireEvent.press(screen.getByText('Открыть сохранённое'))
    expect(onOpenSaved).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Повторить')).toBeNull()
  })
})
