import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let useState: typeof import('react').useState
let SimpleMultiSelect: typeof import('@/components/forms/SimpleMultiSelect').default

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('@shopify/flash-list', () => ({ FlashList: () => null }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/hooks/useTheme', () => ({
    useThemedColors: () => require('@/constants/designSystem').getThemedColors(false),
  }))
  ;({ act, createElement, useState } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  SimpleMultiSelect = require('@/components/forms/SimpleMultiSelect').default
})

it('exposes and updates actual web checkbox checked state for selected countries', async () => {
  const data = [{ country_id: 616, title_ru: 'Poland' }, { country_id: 250, title_ru: 'France' }]
  function Field() {
    const [value, setValue] = useState<Array<string | number>>(['616'])
    return createElement(SimpleMultiSelect, {
      data, value, onChange: setValue, labelField: 'title_ru', valueField: 'country_id',
    })
  }
  const host = document.createElement('div')
  document.body.appendChild(host)
  let root: Root | undefined
  try {
    await act(async () => { root = createRoot(host); root.render(createElement(Field)) })
    expect(host.querySelector('[data-testid="simple-multiselect.web-selected-list"]')).not.toBeNull()
    const open = host.querySelector<HTMLElement>('[data-testid="simple-multiselect.open-button"]')!
    await act(async () => { open.click() })
    const options = document.querySelector('[data-testid="simple-multiselect.web-options-list"]')
    expect(options).not.toBeNull()
    expect(host.contains(options)).toBe(false) // Actual RNW Modal renders a body portal.
    const poland = options!.querySelector<HTMLElement>('[data-testid="simple-multiselect.item.616"]')!
    const france = options!.querySelector<HTMLElement>('[data-testid="simple-multiselect.item.250"]')!
    expect(poland.getAttribute('role')).toBe('checkbox')
    expect(poland.getAttribute('aria-checked')).toBe('true')
    expect(france.getAttribute('aria-checked')).toBe('false')
    await act(async () => { poland.click() })
    expect(poland.getAttribute('aria-checked')).toBe('false')
    await act(async () => { france.click() })
    expect(france.getAttribute('aria-checked')).toBe('true')
  } finally {
    await act(async () => root?.unmount())
    host.remove()
  }
})
