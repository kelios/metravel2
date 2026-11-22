import { act, createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { useLoaderData } from 'expo-router'
import TravelLoaderScreen from '@/components/travel/details/TravelLoaderScreen.web'
import * as model from '@/components/travel/details/hooks/travelDetailsContainerViewModel'

const { renderToString }: typeof import('react-dom/server') = require('react-dom/server.node')
jest.mock('expo-router', () => ({ useLoaderData: jest.fn() }))
const mockPhotoTap = jest.fn()
jest.mock('@/components/travel/details/TravelDetailsContainer', () => () => <button onPointerDown={mockPhotoTap}>Фото</button>)

it('keeps the server article graph during an early tap and replaces it when the loader changes', async () => {
  const load = useLoaderData as jest.Mock
  const faq = { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Когда ехать?' }] }
  const first = { routeKey: 'first-route', travel: { id: 1, slug: 'first-route', name: 'Первый маршрут',
    description: 'Описание маршрута', user: { id: 3, name: 'Автор' } }, authorSameAs: ['https://example.org/author'], faqJsonLd: faq }
  load.mockReturnValue(first)
  const metadata = jest.spyOn(model, 'getTravelDetailsSeoMetadata')
  const host = document.createElement('div')
  document.body.appendChild(host)
  const graph = () => JSON.parse(host.querySelector('script[data-seo-jsonld="travel-article"]')!.textContent!)['@graph']
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    host.innerHTML = renderToString(createElement(TravelLoaderScreen))
    expect(graph()).toMatchObject([
      { '@type': 'Article', headline: 'Первый маршрут', author: { sameAs: first.authorSameAs } },
      { '@type': 'BreadcrumbList' },
      faq,
    ])
    const serverScript = host.querySelector('script')!
    metadata.mockClear()
    act(() => {
      root = hydrateRoot(host, createElement(TravelLoaderScreen), { onRecoverableError: error => errors.push(error) })
      host.querySelector('button')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      expect(mockPhotoTap).toHaveBeenCalledTimes(1)
      expect(metadata).not.toHaveBeenCalled()
    })
    expect(host.querySelector('script')).toBe(serverScript)
    load.mockReturnValue({ ...first, routeKey: 'next-route', travel: { id: 2, slug: 'next-route', name: 'Второй маршрут' }, faqJsonLd: null })
    await act(async () => root!.render(createElement(TravelLoaderScreen)))
    expect(graph()).toMatchObject([
      { '@type': 'Article', headline: 'Второй маршрут', url: expect.stringMatching(/\/travels\/next-route$/) },
      { '@type': 'BreadcrumbList' },
    ])
    load.mockReturnValue(null)
    await act(async () => root!.render(createElement(TravelLoaderScreen)))
    expect(host.querySelector('script')).toBeNull()
    expect(errors).toEqual([])
  } finally {
    await act(async () => root?.unmount())
    host.remove()
    metadata.mockRestore()
  }
})
