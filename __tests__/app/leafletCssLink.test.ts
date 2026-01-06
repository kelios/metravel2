import Root from '@/app/+html'

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

describe('app/+html Leaflet CSS', () => {
  it('does not include Leaflet CSS globally (loaded lazily when map is used)', () => {
    const element = Root({ children: null }) as any

    const headChildren = element?.props?.children?.find((c: any) => c?.type === 'head')?.props
      ?.children

    const headArray = Array.isArray(headChildren) ? headChildren : [headChildren].filter(Boolean)

    const stylesheetLinks = headArray.filter(
      (node: any) => node?.type === 'link' && node?.props?.rel === 'stylesheet' && node?.props?.href === LEAFLET_CSS_HREF
    )

    expect(stylesheetLinks.length).toBe(0)
  })
})
