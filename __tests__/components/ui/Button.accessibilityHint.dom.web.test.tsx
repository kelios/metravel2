import type React from 'react'
import '@testing-library/jest-dom'

let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let Button: React.ComponentType<any>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  Button = require('@/components/ui/Button').default
})

it.each([undefined, 'https://example.com/route'])('describes a button/link without changing its name or layout (%s)', (href) => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(Button, {
    label: 'Open route', accessibilityHint: 'Opens the route details.', href,
  }))
  document.body.appendChild(host)
  try {
    const control = host.querySelector(href ? 'a' : '[role="button"]')!
    expect(control).toHaveAccessibleName('Open route')
    expect(control).toHaveAccessibleDescription('Opens the route details.')
    expect(control).not.toHaveAttribute('aria-description')
    const hint = document.getElementById(control.getAttribute('aria-describedby')!)
    expect(hint).toHaveTextContent('Opens the route details.')
    expect(hint).not.toBeVisible()
  } finally {
    host.remove()
  }
})

it('keeps multiple descriptions distinct and omits an absent hint', () => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement('div', null,
    createElement(Button, { label: 'First', accessibilityHint: 'First description.' }),
    createElement(Button, { label: 'Second', accessibilityHint: 'Second description.' }),
    createElement(Button, { label: 'Third' }),
  ))
  document.body.appendChild(host)
  try {
    const [first, second, third] = host.querySelectorAll('[role="button"]')
    expect(first).toHaveAccessibleDescription('First description.')
    expect(second).toHaveAccessibleDescription('Second description.')
    expect(first.getAttribute('aria-describedby')).not.toBe(second.getAttribute('aria-describedby'))
    expect(third).not.toHaveAttribute('aria-describedby')
    expect(third).not.toHaveAccessibleDescription()
  } finally {
    host.remove()
  }
})
