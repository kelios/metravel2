import { render, waitFor } from '@testing-library/react-native'

import WebAppRuntimeEffects from '@/components/layout/WebAppRuntimeEffects'

describe('WebAppRuntimeEffects', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('preserves native history.replaceState semantics', async () => {
    const originalReplaceState = window.history.replaceState

    const view = await render(<WebAppRuntimeEffects pathname="/search" />)

    expect(window.history.replaceState).toBe(originalReplaceState)

    await view.unmount()
    expect(window.history.replaceState).toBe(originalReplaceState)
  })

  it('moves focus to the real main-content anchor after navigation', async () => {
    const main = document.createElement('div')
    main.id = 'main-content'
    document.body.appendChild(main)

    const view = await render(<WebAppRuntimeEffects pathname="/search" />)

    await waitFor(() => {
      expect(document.activeElement).toBe(main)
    })

    await view.rerender(<WebAppRuntimeEffects pathname="/places" />)
    await waitFor(() => {
      expect(document.activeElement).toBe(main)
    })
  })
})
