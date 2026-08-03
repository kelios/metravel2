import { normalizeToTravel } from '@/components/profile/travelNormalize'
import { getMediaPlaceholderData } from '@/utils/travelMediaVariants'

// Ответ `/api/travels/` в форме, которую получает профиль (`fetchMyTravels`).
const apiItem = {
  id: 682,
  name: 'Заброшенные дворцы',
  url: '/travels/zabroshennye-dvortsy',
  travel_image_thumb_url: 'https://metravel.by/travel-image/682/thumb.webp',
  media: {
    cover: {
      id: 682,
      dominant_color: '#666b6d',
      blurhash: 'LVD0ZON0tRxa.Ao$ofoe%hbKa~t6',
      variants: {
        thumb_320: '/travel-image/682/conversions/cover.webp?w=320',
        card_640: '/travel-image/682/conversions/cover.webp?w=640',
      },
    },
  },
}

describe('normalizeToTravel: media manifest', () => {
  it('пробрасывает манифест обложки, чтобы карточке профиля было чем залить поля letterbox', () => {
    const travel = normalizeToTravel(apiItem)

    expect(travel.media?.cover?.dominant_color).toBe('#666b6d')
    // Именно это значение уходит в `placeholderColor` карточки: без него
    // web-подложки под `contain`-фото нет вовсе.
    expect(getMediaPlaceholderData(travel.media?.cover).dominantColor).toBe('#666b6d')
    expect(travel.media?.cover?.variants?.card_640).toBe(
      '/travel-image/682/conversions/cover.webp?w=640',
    )
  })

  it('не подставляет мусор, когда манифеста в payload нет', () => {
    expect(normalizeToTravel({ id: 1, name: 'Без манифеста' }).media).toBeUndefined()
    expect(normalizeToTravel({ id: 2, name: 'Массив', media: [] }).media).toBeUndefined()
    expect(normalizeToTravel({ id: 3, name: 'Строка', media: 'cover' }).media).toBeUndefined()
  })
})
