import { render } from '@testing-library/react-native'
import React from 'react'
import { Platform } from 'react-native'

import TripPlanLinkedText, {
  buildTripPlanLinkProps,
  extractTripPlanLinks,
  resolveTripPlanLink,
  splitTripPlanLinkedText,
} from '@/components/trips/planning/TripPlanLinkedText'

describe('splitTripPlanLinkedText', () => {
  it('keeps normal text and extracts http links', () => {
    expect(splitTripPlanLinkedText('Описание https://example.com/info.')).toEqual([
      { type: 'text', text: 'Описание ' },
      {
        type: 'link',
        text: 'https://example.com/info',
        url: 'https://example.com/info',
        href: 'https://example.com/info',
        internal: false,
        domain: 'example.com',
      },
      { type: 'text', text: '.' },
    ])
  })

  it('normalizes www links to https', () => {
    expect(splitTripPlanLinkedText('Маршрут: www.example.com/gr131')).toEqual([
      { type: 'text', text: 'Маршрут: ' },
      {
        type: 'link',
        text: 'www.example.com/gr131',
        url: 'https://www.example.com/gr131',
        href: 'https://www.example.com/gr131',
        internal: false,
        domain: 'example.com',
      },
    ])
  })

  it('links bare domains written without a protocol', () => {
    const segments = splitTripPlanLinkedText('Бронь booking.com и парковка parking.by/city')
    expect(segments.filter((segment) => segment.type === 'link')).toEqual([
      {
        type: 'link',
        text: 'booking.com',
        url: 'https://booking.com/',
        href: 'https://booking.com/',
        internal: false,
        domain: 'booking.com',
      },
      {
        type: 'link',
        text: 'parking.by/city',
        url: 'https://parking.by/city',
        href: 'https://parking.by/city',
        internal: false,
        domain: 'parking.by',
      },
    ])
  })

  it('marks metravel.by links as internal and keeps the in-app path', () => {
    const segments = splitTripPlanLinkedText('Смотри metravel.by/travels/123 перед выездом')
    expect(segments[1]).toEqual({
      type: 'link',
      text: 'metravel.by/travels/123',
      url: 'https://metravel.by/travels/123',
      href: '/travels/123',
      internal: true,
      domain: 'metravel.by',
    })
  })

  it('does not turn emails, file names or plain text into links', () => {
    for (const value of [
      'Пишите на mail@example.com',
      'Файл index.html рядом',
      'и т.д. и т.п.',
      // расширения, совпадающие с живыми TLD: .md (Молдова), .rs (Сербия), .sh
      'Файл readme.md в архиве',
      'Скрипт main.rs и deploy.sh',
      // латиница с пропущенным пробелом после точки — не домен
      'Take water.It gets hot in July',
      'Bring cash.In the village there is no ATM',
    ]) {
      expect(splitTripPlanLinkedText(value).every((segment) => segment.type === 'text')).toBe(true)
    }
  })

  it('still links a capitalized domain and a rare TLD when a path follows', () => {
    expect(splitTripPlanLinkedText('Бронь Booking.com сегодня')[1]).toMatchObject({
      type: 'link',
      url: 'https://booking.com/',
    })
    expect(splitTripPlanLinkedText('Гид docs.example.md/guide тут')[1]).toMatchObject({
      type: 'link',
      url: 'https://docs.example.md/guide',
    })
  })

  // Регрессия на катастрофический откат: склеенная строка из латиницы и точек
  // раньше разбиралась секундами и вешала поток на вводе описания.
  it('parses a long dotted token without backtracking blowup', () => {
    const value = `Заметка ${'ab.'.repeat(4000)}cd конец`
    const startedAt = process.hrtime.bigint()
    splitTripPlanLinkedText(value)
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    expect(elapsedMs).toBeLessThan(2000)
  })

  it('rejects unsafe schemes instead of rendering them as links', () => {
    expect(resolveTripPlanLink('javascript:alert(1)')).toBeNull()
    expect(resolveTripPlanLink('data:text/html;base64,PHNjcmlwdD4=')).toBeNull()
  })
})

describe('extractTripPlanLinks', () => {
  it('collects unique links with their domains in order', () => {
    const links = extractTripPlanLinks(
      'Отель https://booking.com/hotel/x, он же https://booking.com/hotel/x, карта www.osm.org/way/1',
    )
    expect(links.map((link) => [link.domain, link.url])).toEqual([
      ['booking.com', 'https://booking.com/hotel/x'],
      ['osm.org', 'https://www.osm.org/way/1'],
    ])
  })

  it('returns nothing for text without links', () => {
    expect(extractTripPlanLinks('Выезжаем в 8 утра от вокзала')).toEqual([])
  })
})

describe('buildTripPlanLinkProps', () => {
  const externalLink = {
    url: 'https://example.com/info',
    href: 'https://example.com/info',
    internal: false,
    domain: 'example.com',
  }

  // Regression guard #1494: на web ссылка обязана быть `<a href>`, а не `Text` с
  // `onPress` — иначе не работают новая вкладка, средняя кнопка и копирование адреса.
  it('renders a real anchor with a new-tab target on web', () => {
    const props = buildTripPlanLinkProps(externalLink, 'web')
    expect(props).toEqual({
      accessibilityRole: 'link',
      href: 'https://example.com/info',
      hrefAttrs: { target: '_blank', rel: 'noopener' },
    })
    expect(props.onPress).toBeUndefined()
  })

  it('keeps internal links in the same tab on web', () => {
    const props = buildTripPlanLinkProps(
      { url: 'https://metravel.by/travels/123', href: '/travels/123', internal: true, domain: 'metravel.by' },
      'web',
    )
    expect(props.href).toBe('/travels/123')
    expect(props.hrefAttrs).toBeUndefined()
  })

  it('falls back to onPress on native, where anchors do not exist', () => {
    const props = buildTripPlanLinkProps(externalLink, 'ios')
    expect(typeof props.onPress).toBe('function')
    expect(props.href).toBeUndefined()
  })
})

describe('TripPlanLinkedText rendering', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  it('passes href to the link segment on web and keeps the text selectable', () => {
    Platform.OS = 'web'
    const { getByTestId, UNSAFE_getAllByProps } = render(
      <TripPlanLinkedText text="Бронь https://example.com/info" testID="desc" />,
    )
    expect(getByTestId('desc').props.selectable).toBe(true)
    expect(UNSAFE_getAllByProps({ href: 'https://example.com/info' }).length).toBeGreaterThan(0)
  })

  // RN #22811: selectable-текст на Android перехватывает тапы по вложенным ссылкам.
  it('does not enable selection on android', () => {
    Platform.OS = 'android'
    const { getByTestId } = render(
      <TripPlanLinkedText text="Бронь https://example.com/info" testID="desc" />,
    )
    expect(getByTestId('desc').props.selectable).toBe(false)
  })
})
