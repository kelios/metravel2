import { downloadUrlOnWeb } from '@/utils/downloadUrlOnWeb'

describe('downloadUrlOnWeb', () => {
  const originalCreateElement = document.createElement.bind(document)
  const originalAppendChild = document.body.appendChild.bind(document.body)
  const originalRemoveChild = document.body.removeChild.bind(document.body)

  afterEach(() => {
    document.createElement = originalCreateElement
    document.body.appendChild = originalAppendChild
    document.body.removeChild = originalRemoveChild
    jest.restoreAllMocks()
  })

  it('clicks a hidden download link for safe relative URLs', () => {
    const click = jest.fn()
    const anchor = {
      click,
      href: '',
      rel: '',
      download: '',
      style: { display: '' },
    } as unknown as HTMLAnchorElement

    document.createElement = jest.fn(() => anchor) as any
    document.body.appendChild = jest.fn() as any
    document.body.removeChild = jest.fn() as any

    const result = downloadUrlOnWeb('/api/travels/1/routes/2/download/', {
      allowRelative: true,
      baseUrl: 'https://metravel.by',
    })

    expect(result).toBe(true)
    expect(anchor.href).toBe('https://metravel.by/api/travels/1/routes/2/download/')
    expect(anchor.download).toBe('')
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.body.appendChild).toHaveBeenCalledWith(anchor)
    expect(document.body.removeChild).toHaveBeenCalledWith(anchor)
  })

  it('rejects unsafe URLs', () => {
    expect(downloadUrlOnWeb('javascript:alert(1)')).toBe(false)
  })
})
