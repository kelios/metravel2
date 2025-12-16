import React from 'react'
import { Platform } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

import SearchAutocomplete from '@/components/SearchAutocomplete'

jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    Feather: ({ name }: any) => React.createElement(Text, null, String(name)),
  }
})

describe('SearchAutocomplete', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    jest.clearAllMocks()
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('renders popular queries when query is empty or too short', async () => {
    const onSelect = jest.fn()
    const { getByText, rerender } = render(
      <SearchAutocomplete query="" onSelect={onSelect} />
    )

    expect(getByText('Минск')).toBeTruthy()
    expect(getByText('Беларусь')).toBeTruthy()

    rerender(<SearchAutocomplete query="м" onSelect={onSelect} />)
    expect(getByText('Минск')).toBeTruthy()
  })

  it('filters suggestions based on query', async () => {
    const onSelect = jest.fn()
    const { getByText, queryByText } = render(
      <SearchAutocomplete query="мин" onSelect={onSelect} />
    )

    expect(getByText('Минск')).toBeTruthy()
    expect(queryByText('Брест')).toBeNull()
  })

  it('calls onSelect and onClose when a suggestion is pressed', async () => {
    const onSelect = jest.fn()
    const onClose = jest.fn()

    const { getByText } = render(
      <SearchAutocomplete query="мин" onSelect={onSelect} onClose={onClose} />
    )

    fireEvent.press(getByText('Минск'))

    expect(onSelect).toHaveBeenCalledWith('Минск')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('supports keyboard navigation on web (ArrowDown + Enter)', async () => {
    const onSelect = jest.fn()

    const { getByText, UNSAFE_getAllByType } = render(
      <SearchAutocomplete query="мин" onSelect={onSelect} />
    )

    // onKeyDown is attached to Pressable (web), not the inner Text node
    const RN = require('react-native')
    const pressables = UNSAFE_getAllByType(RN.Pressable)
    expect(pressables.length).toBeGreaterThan(0)

    // Find the Pressable that owns the 'Минск' suggestion
    const target = pressables.find((node: any) => {
      try {
        return node
          .findAllByType(RN.Text)
          .some((t: any) => String(t.props.children) === 'Минск')
      } catch {
        return false
      }
    })

    expect(target).toBeTruthy()
    expect(getByText('Минск')).toBeTruthy()

    const onKeyDown = (target as any).props?.onKeyDown
    expect(typeof onKeyDown).toBe('function')

    onKeyDown({ key: 'ArrowDown', preventDefault: jest.fn() })
    onKeyDown({ key: 'Enter', preventDefault: jest.fn() })

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('Минск')
    })
  })

  it('calls onClose on Escape', async () => {
    const onSelect = jest.fn()
    const onClose = jest.fn()

    const { getByText, UNSAFE_getAllByType } = render(
      <SearchAutocomplete query="мин" onSelect={onSelect} onClose={onClose} />
    )

    const RN = require('react-native')
    const pressables = UNSAFE_getAllByType(RN.Pressable)
    expect(pressables.length).toBeGreaterThan(0)

    const target = pressables.find((node: any) => {
      try {
        return node
          .findAllByType(RN.Text)
          .some((t: any) => String(t.props.children) === 'Минск')
      } catch {
        return false
      }
    })

    expect(target).toBeTruthy()
    expect(getByText('Минск')).toBeTruthy()

    const onKeyDown = (target as any).props?.onKeyDown
    expect(typeof onKeyDown).toBe('function')
    onKeyDown({ key: 'Escape', preventDefault: jest.fn() })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
