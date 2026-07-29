import { isWeservImageUrl, unwrapWeservImageUrl } from '@/utils/weservImageUrl'

describe('weservImageUrl', () => {
  it('unwraps every proxy layer and restores an absolute origin URL', () => {
    const origin = 'metravelprod.s3.eu-north-1.amazonaws.com/uploads/photo.jpg'
    const nested = [0, 1, 2, 3, 4, 5, 6].reduce(
      (current) => `https://images.weserv.nl/?url=${encodeURIComponent(current)}&w=800`,
      origin,
    )

    expect(unwrapWeservImageUrl(nested)).toBe(`https://${origin}`)
  })

  it('leaves ordinary image URLs unchanged', () => {
    const source = 'https://metravel.by/gallery/1/photo.jpg?w=640'

    expect(unwrapWeservImageUrl(source)).toBe(source)
    expect(isWeservImageUrl(source)).toBe(false)
  })
})
