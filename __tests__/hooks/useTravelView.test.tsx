import React, { StrictMode } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'
import { TravelViewVisitProvider, useTravelView } from '@/hooks/useTravelView'

let mockFocused = true
const mockAuthState = { authReady: true }
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }))
jest.mock('@/context/AuthContext', () => ({
  useAuth: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}))

function Reader({ id }: { id?: number }) {
  useTravelView(id)
  return <div>article {id}</div>
}

describe('human view visible-visit lifecycle', () => {
  const originalFetch = global.fetch
  const originalOS = Platform.OS
  const fetchMock = jest.fn()

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    global.fetch = fetchMock
    fetchMock.mockReset().mockResolvedValue({ status: 204 })
    mockFocused = true
    mockAuthState.authReady = true
  })
  afterEach(() => {
    global.fetch = originalFetch
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  })

  it('sends once after commit despite StrictMode replay and ordinary rerenders', async () => {
    const view = render(<StrictMode><Reader id={17} /></StrictMode>)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    view.rerender(<StrictMode><Reader id={17} /></StrictMode>)
    view.rerender(<StrictMode><Reader id={17} /></StrictMode>)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/travels\/17\/view\/$/)
  })

  it('waits for restored auth and actual route focus', async () => {
    mockAuthState.authReady = false
    const view = render(<Reader id={17} />)
    expect(fetchMock).not.toHaveBeenCalled()
    mockAuthState.authReady = true
    mockFocused = false
    view.rerender(<Reader id={17} />)
    expect(fetchMock).not.toHaveBeenCalled()
    mockFocused = true
    view.rerender(<Reader id={17} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('records each changed article visit including A to B to A without a global read registry', async () => {
    const view = render(<Reader id={17} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    view.rerender(<Reader id={18} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    view.rerender(<Reader id={17} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls.map(([url]) => url.match(/travels\/(\d+)\/view/)[1])).toEqual(['17', '18', '17'])
  })

  it('allows one new event after genuine blur and refocus of a retained screen', async () => {
    const view = render(<Reader id={17} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    mockFocused = false
    view.rerender(<Reader id={17} />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    mockFocused = true
    view.rerender(<Reader id={17} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('resets the scoped visit on blur even while the article subtree is absent', async () => {
    const view = render(<TravelViewVisitProvider><Reader id={17} /></TravelViewVisitProvider>)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    view.rerender(<TravelViewVisitProvider>{null}</TravelViewVisitProvider>)
    mockFocused = false
    view.rerender(<TravelViewVisitProvider>{null}</TravelViewVisitProvider>)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    mockFocused = true
    view.rerender(<TravelViewVisitProvider><Reader id={17} /></TravelViewVisitProvider>)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it.each([undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('does not count missing or invalid ID %s', id => {
    render(<Reader id={id} />)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not retry a rejected event on rerender or auth-state updates during the same visit', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const view = render(<Reader id={17} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    mockAuthState.authReady = false
    view.rerender(<Reader id={17} />)
    mockAuthState.authReady = true
    view.rerender(<Reader id={17} />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never counts rendering on the server', () => {
    expect(renderToString(<Reader id={17} />)).toContain('article')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
