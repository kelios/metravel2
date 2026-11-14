import React, { useEffect, useState } from 'react'
import { Pressable, Text } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import { EditorSession, useEndEditorSession } from '@/components/travel/upsert/EditorSession'

let mockIsFocused = true
jest.mock('expo-router', () => ({
  __esModule: true,
  useIsFocused: () => mockIsFocused,
}))

const mounts = jest.fn()
const unmounts = jest.fn()

// Стоит на месте редактора: «набранное» живёт в состоянии, как правки в форме.
function Editor() {
  const end = useEndEditorSession()
  const [typed, setTyped] = useState('')
  useEffect(() => {
    mounts()
    return () => unmounts()
  }, [])
  return (
    <>
      <Text testID="typed">{typed}</Text>
      <Pressable testID="type" onPress={() => setTyped('набранный текст')} />
      <Pressable testID="exit" onPress={end} />
    </>
  )
}

const tree = () => <EditorSession><Editor /></EditorSession>

describe('EditorSession (#3400)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused = true
  })

  it('keeps the typed form across a blur that no explicit exit asked for (another tab and back)', async () => {
    const view = await render(tree())
    await act(() => { fireEvent.press(view.getByTestId('type')) })

    mockIsFocused = false
    await view.rerender(tree())
    mockIsFocused = true
    await view.rerender(tree())

    expect(view.getByTestId('typed').props.children).toBe('набранный текст')
    expect(mounts).toHaveBeenCalledTimes(1)
    expect(unmounts).not.toHaveBeenCalled()
  })

  it('ends the session on an explicit exit: the hidden editor is gone, the next entry is a fresh one', async () => {
    const view = await render(tree())
    await act(() => { fireEvent.press(view.getByTestId('type')) })
    await act(() => { fireEvent.press(view.getByTestId('exit')) })

    // Переход ещё не состоялся: экран в фокусе, редактор не должен исчезнуть.
    expect(view.getByTestId('typed').props.children).toBe('набранный текст')
    expect(unmounts).not.toHaveBeenCalled()

    mockIsFocused = false
    await view.rerender(tree())
    expect(view.queryByTestId('typed')).toBeNull()
    expect(unmounts).toHaveBeenCalledTimes(1)

    mockIsFocused = true
    await view.rerender(tree())
    expect(view.getByTestId('typed').props.children).toBe('')
    expect(mounts).toHaveBeenCalledTimes(2)
  })

  it('starts each session clean: an exit ends only the session it was asked in', async () => {
    const view = await render(tree())
    await act(() => { fireEvent.press(view.getByTestId('exit')) })
    mockIsFocused = false
    await view.rerender(tree())
    mockIsFocused = true
    await view.rerender(tree())

    await act(() => { fireEvent.press(view.getByTestId('type')) })
    mockIsFocused = false
    await view.rerender(tree())
    mockIsFocused = true
    await view.rerender(tree())

    expect(view.getByTestId('typed').props.children).toBe('набранный текст')
    expect(mounts).toHaveBeenCalledTimes(2)
  })

  it('is a no-op outside a session, so the editor parts stay usable on their own', async () => {
    const view = await render(<Editor />)
    await act(() => { fireEvent.press(view.getByTestId('exit')) })
    expect(view.getByTestId('typed')).toBeTruthy()
  })
})
