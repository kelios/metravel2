import {
  applyWebTooltipAttributes,
  buildWebAccessibilityAttributes,
} from '@/components/ui/CardActionPressable'

describe('applyWebTooltipAttributes', () => {
  it('writes tooltip attributes to the web node', () => {
    const node = {
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
    }

    applyWebTooltipAttributes(node, 'Открыть в Google Maps')

    expect(node.setAttribute).toHaveBeenCalledWith('title', 'Открыть в Google Maps')
    expect(node.setAttribute).toHaveBeenCalledWith('data-tooltip', 'Открыть в Google Maps')
    expect(node.removeAttribute).not.toHaveBeenCalled()
  })

  it('removes tooltip attributes when tooltip text is empty', () => {
    const node = {
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
    }

    applyWebTooltipAttributes(node, '')

    expect(node.removeAttribute).toHaveBeenCalledWith('title')
    expect(node.removeAttribute).toHaveBeenCalledWith('data-tooltip')
  })
})

describe('buildWebAccessibilityAttributes', () => {
  it('maps checked and disabled state to explicit ARIA attributes', () => {
    expect(
      buildWebAccessibilityAttributes({ checked: true, disabled: false }),
    ).toEqual({
      'aria-checked': 'true',
      'aria-disabled': 'false',
    })
  })

  it('maps selected, expanded and busy state to explicit ARIA attributes', () => {
    expect(
      buildWebAccessibilityAttributes({
        selected: true,
        expanded: false,
        busy: true,
      }),
    ).toEqual({
      'aria-selected': 'true',
      'aria-expanded': 'false',
      'aria-busy': 'true',
    })
  })
})
