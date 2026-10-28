import React from 'react'
import { Text } from 'react-native'
import { act, render } from '@testing-library/react-native'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import MapErrorBoundary from '@/components/MapPage/MapErrorBoundary'
import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary'
import i18n from '@/i18n/instance'
import { ThemeContext } from '@/hooks/useTheme'

describe('locale-aware error boundary instances (#2442)', () => {
  it.each([
    ['general', ErrorBoundary], ['map', MapErrorBoundary], ['travel form', TravelFormErrorBoundary],
  ] as const)('retains the %s class, error and retry state while rendering the new language', async (_name, Boundary) => {
    const ref = React.createRef<any>()
    await act(async () => { await i18n.changeLanguage('ru') })
    const result = await render(<ThemeContext.Provider value={{ isDark: true } as any}>
      <Boundary ref={ref}><Text>healthy child</Text></Boundary>
    </ThemeContext.Provider>)
    const instance = ref.current
    const failure = new Error('preserved error')
    await act(() => instance.setState({ hasError: true, error: failure }))
    const before = JSON.stringify(result.toJSON())
    expect(before).not.toContain('healthy child')
    // These counters are owned by their class and must not reset on language.
    instance._autoRetryCount = 1
    instance._leafletAutoRetryCount = 1
    try {
      await act(async () => { await i18n.changeLanguage('en') })
      expect(ref.current).toBe(instance)
      expect(instance.state.error).toBe(failure)
      expect(instance.state.hasError).toBe(true)
      expect(instance._autoRetryCount).toBe(1)
      expect(instance._leafletAutoRetryCount).toBe(1)
      expect(instance.context?.isDark).toBe(true)
      expect(JSON.stringify(result.toJSON())).not.toBe(before)
      expect(JSON.stringify(result.toJSON())).not.toContain('healthy child')
    } finally { await act(async () => { await i18n.changeLanguage('ru') }) }
  })
})
