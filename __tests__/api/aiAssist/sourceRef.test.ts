/**
 * #2897: ссылка на страницу-источник ассистента — общий модуль экрана, клиента `ask`
 * и сервера `/ai/ask`; формат параметра роута задаёт `utils/aiAssistantConfig.ts`.
 */
import { formatSourceRef, parseSourceRef, pinSourceFirst } from '@/api/aiAssist/sourceRef'
import type { AiSource } from '@/api/aiAssist/types'
import { buildAssistantSourceHref } from '@/utils/aiAssistantConfig'

const card = (type: AiSource['type'], id: string, url = `https://metravel.by/${type}s/${id}`): AiSource => ({
  type,
  source_id: id,
  title: `${type} ${id}`,
  url,
  path: new URL(url).pathname,
  snippet: '',
  score: 1,
})

describe('aiAssist sourceRef (#2897)', () => {
  it('разбирает параметр роута и объект тела /ai/ask; мусор — null', () => {
    expect(parseSourceRef('travel:816')).toEqual({ type: 'travel', id: 816 })
    expect(parseSourceRef(' quest:12 ')).toEqual({ type: 'quest', id: 12 })
    expect(parseSourceRef(['quest:3', 'travel:1'])).toEqual({ type: 'quest', id: 3 })
    expect(parseSourceRef({ type: 'travel', id: 816 })).toEqual({ type: 'travel', id: 816 })
    expect(parseSourceRef({ type: 'quest', id: '7' })).toEqual({ type: 'quest', id: 7 })
    for (const bad of ['travel', 'travel:', 'book:1', 'travel:0', 'travel:-1', 'travel:1.5', 'travel:1e3', '', null, undefined, 816, { type: 'travel' }, { type: 'quest', id: 'x' }, { type: 'travel', id: 0 }]) {
      expect(parseSourceRef(bad)).toBeNull()
    }
  })

  it('ссылка со страницы и разбор роута — один формат', () => {
    const href = buildAssistantSourceHref({ type: 'travel', id: 816 })
    expect(href).toBe('/assistant?source=travel:816')
    const param = new URL(href, 'https://metravel.by').searchParams.get('source')
    expect(parseSourceRef(param)).toEqual({ type: 'travel', id: 816 })
    expect(formatSourceRef({ type: 'quest', id: 5 })).toBe('quest:5')
  })

  it('закреплённая карточка первой, без дубля по type:source_id, в пределах лимита', () => {
    const pinned = card('quest', '1', 'https://metravel.by/quests/1-pl')
    const found = [card('travel', '816'), card('quest', '1'), card('travel', '761')]
    expect(pinSourceFirst(pinned, found, 8).map((s) => `${s.type}:${s.source_id}`)).toEqual(['quest:1', 'travel:816', 'travel:761'])
    expect(pinSourceFirst(pinned, found, 2).map((s) => s.source_id)).toEqual(['1', '816'])
    expect(pinSourceFirst(null, found, 2)).toEqual(found.slice(0, 2))
  })
})
