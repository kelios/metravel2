/**
 * #2885: пункт «SEO-описание» в рекомендуемом чек-листе публикации — есть и в
 * бюджете 160 знаков; без него пункт кликабелен и ведёт к полю на шаге публикации,
 * а в список блокирующих модерацию не входит.
 */
import { renderHook } from '@testing-library/react-native'

import { useTravelPublishChecklist } from '@/components/travel/useTravelPublishChecklist'
import type { TravelFormData } from '@/types/types'
import { getEmptyFormData, TRAVEL_META_DESCRIPTION_ANCHOR_ID, TRAVEL_WIZARD_PUBLISH_STEP } from '@/utils/travelFormUtils'

const base: TravelFormData = {
  ...getEmptyFormData('640'),
  name: 'Гродно за два дня',
  description: 'Достаточно длинное описание маршрута, чтобы пройти проверку модерации на пятьдесят знаков.',
  countries: ['1'],
  categories: ['1'],
  coordsMeTravel: [{ lat: 0, lng: 0, categories: ['1'], address: 'Rynek 5' }],
  travel_image_thumb_small_url: 'https://example.com/cover.jpg',
}

const seoItem = async (formData: TravelFormData) => {
  const { result } = await renderHook(() => useTravelPublishChecklist(formData))
  const item = result.current.recommendedChecklist.find((entry) => entry.key === 'meta_description')
  return { item, result }
}

describe('useTravelPublishChecklist: SEO-описание (#2885)', () => {
  it('пустое — пункт не выполнен и кликабелен (issue ведёт на шаг публикации к якорю), модерацию не блокирует', async () => {
    const { item, result } = await seoItem(base)
    expect(item).toMatchObject({ ok: false })
    expect(item?.detail).toContain('160')
    expect(result.current.moderationIssuesByKey.get('meta_description')).toMatchObject({
      key: 'meta_description',
      targetStep: TRAVEL_WIZARD_PUBLISH_STEP,
      anchorId: TRAVEL_META_DESCRIPTION_ANCHOR_ID,
    })
    expect(result.current.moderationIssues.map((issue) => issue.key)).not.toContain('meta_description')
    expect(result.current.requiredChecklist.map((entry) => entry.key)).not.toContain('meta_description')
  })

  it('в бюджете — выполнен, перехода нет; длиннее 160 — снова не выполнен', async () => {
    const ok = await seoItem({ ...base, meta_description: 'Два дня в Гродно с детьми: замок, Неман и кафе.' })
    expect(ok.item?.ok).toBe(true)
    expect(ok.result.current.moderationIssuesByKey.has('meta_description')).toBe(false)

    const over = await seoItem({ ...base, meta_description: 'x'.repeat(161) })
    expect(over.item?.ok).toBe(false)
    expect(over.result.current.moderationIssuesByKey.has('meta_description')).toBe(true)

    const spaces = await seoItem({ ...base, meta_description: '   ' })
    expect(spaces.item?.ok).toBe(false)
  })
})
