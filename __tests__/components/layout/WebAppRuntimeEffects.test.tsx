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

  it('preserves a control focused before lazy mount, then focuses main on a real navigation', async () => {
    const main = document.createElement('div')
    main.id = 'main-content'
    const button = document.createElement('button')
    button.textContent = 'Open conversation'
    main.appendChild(button)
    document.body.appendChild(main)
    button.focus()

    const view = await render(<WebAppRuntimeEffects pathname="/messages" />)

    expect(document.activeElement).toBe(button)

    await view.rerender(<WebAppRuntimeEffects pathname="/places" />)
    expect(document.activeElement).toBe(main)
  })

  it('focuses main when the initial active element is the application root', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    root.tabIndex = -1
    const main = document.createElement('div')
    main.id = 'main-content'
    root.appendChild(main)
    document.body.appendChild(root)
    root.focus()

    await render(<WebAppRuntimeEffects pathname="/messages" />)

    expect(document.activeElement).toBe(main)
  })
})
