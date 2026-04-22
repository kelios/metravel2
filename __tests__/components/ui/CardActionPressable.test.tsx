import { applyWebTooltipAttributes } from '@/components/ui/CardActionPressable'

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
