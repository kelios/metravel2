import type { MapPoint } from '@/types/article-pdf'

/**
 * Генерирует URL для статичной карты через Google Static Maps API
 */
export function generateStaticMapUrl(
  points: MapPoint[],
  options: {
    width?: number
    height?: number
    zoom?: number
    apiKey?: string
  } = {},
): string {
  if (points.length === 0) {
    return ''
  }

  const { width = 800, height = 600, zoom = 12, apiKey } = options

  if (!apiKey) {
    return ''
  }

  const markers = points
    .map((point, index) => {
      const color = index === 0 ? 'green' : index === points.length - 1 ? 'red' : 'blue'
      return `color:${color}|label:${index + 1}|${point.lat},${point.lng}`
    })
    .join('&markers=')

  const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length
  const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length

  const path = points.map((p) => `${p.lat},${p.lng}`).join('|')

  return `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&zoom=${zoom}&center=${centerLat},${centerLng}&markers=${markers}&path=color:0xff9f5a|weight:5|${path}&key=${apiKey}`
}
