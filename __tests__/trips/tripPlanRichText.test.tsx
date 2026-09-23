// #2070: лёгкая разметка текста плана — разбор, экран и печать.
import React from 'react'
import { Platform, Text } from 'react-native'
import { render } from '@testing-library/react-native'

import TripPlanLinkedText, { extractTripPlanLinks } from '@/components/trips/planning/TripPlanLinkedText'
import { parseTripPlanInline, parseTripPlanRichText } from '@/components/trips/planning/tripPlanRichText'

const PLAN = [
  'Отпуск по Люксембургу.',
  '',
  'ПО ДНЯМ',
  '',
  '27.09 вс · Route 1: Эхтернах → Born',
  '_21,5 км · ≈ +400 м_',
  'Ночь: Burer Millen, **своя кухня**.',
  '',
  'НОЧЁВКИ',
  '26.09 · Victor Hugo',
  '27.09 · Burer Millen',
  '',
  '## Что взять',
  '- фонарь',
  '• дождевик',
  '1. паспорт',
].join('\n')

describe('parseTripPlanRichText', () => {
  it('размечает разделы, день, список и подписи', () => {
    const lines = parseTripPlanRichText(PLAN)
    expect(lines.map((line) => line.kind)).toEqual([
      'text', 'blank', 'section', 'blank', 'day', 'text', 'text', 'blank',
      'section', 'text', 'text', 'blank', 'day', 'bullet', 'bullet', 'bullet',
    ])
    // Строки подряд с датами — список, а не заголовки дней.
    expect(lines[9]).toEqual({ kind: 'text', inlines: [{ text: '26.09 · Victor Hugo', bold: false, italic: false }] })
    expect(lines[6]).toEqual({
      kind: 'text',
      inlines: [
        { text: 'Ночь:', bold: true, italic: false },
        { text: ' Burer Millen, ', bold: false, italic: false },
        { text: 'своя кухня', bold: true, italic: false },
        { text: '.', bold: false, italic: false },
      ],
    })
    expect(lines[15]).toMatchObject({ kind: 'bullet', marker: '1.' })
  })

  it('курсив и жирный — только по границам слов: адреса и snake_case не ломаются', () => {
    expect(parseTripPlanInline('_21,5 км_ и *важно*')).toEqual([
      { text: '21,5 км', bold: false, italic: true },
      { text: ' и ', bold: false, italic: false },
      { text: 'важно', bold: false, italic: true },
    ])
    expect(parseTripPlanInline('https://site.com/a_b_c и file_name_here')).toEqual([
      { text: 'https://site.com/a_b_c и file_name_here', bold: false, italic: false },
    ])
    expect(parseTripPlanInline('**жирный _и курсив_**')).toEqual([
      { text: 'жирный ', bold: true, italic: false },
      { text: 'и курсив', bold: true, italic: true },
    ])
    // Время и ссылка не становятся подписью.
    expect(parseTripPlanRichText('08:10 автобус')[0]).toMatchObject({ kind: 'text', inlines: [{ bold: false }] })
    expect(parseTripPlanRichText('https://example.com: бронь')[0]).toMatchObject({ kind: 'text', inlines: [{ bold: false }] })
  })

  it('время, дроби, коды брони и трасс не становятся заголовками', () => {
    const kinds = (value: string) => parseTripPlanRichText(value).map((line) => line.kind)
    expect(kinds('14.00 обед в Эхтернахе\nпотом парк')).toEqual(['text', 'text'])
    expect(kinds('10.30–12.00 музей\nпотом парк')).toEqual(['text', 'text'])
    expect(kinds('5.5 km to the lake\nthen bus')).toEqual(['text', 'text'])
    expect(kinds('X7K2QP')).toEqual(['text'])
    expect(kinds('E40 / A4 / N4')).toEqual(['text'])
    expect(kinds('02.10–04.10 Люксембург\nтекст')).toEqual(['day', 'text'])
  })

  it('первый день сразу под заголовком раздела — тоже заголовок дня', () => {
    expect(
      parseTripPlanRichText('ПО ДНЯМ\n27.09 вс · Route 1\n_21 км_\n\n28.09 пн · Route 2\n_18 км_').map(
        (line) => line.kind,
      ),
    ).toEqual(['section', 'day', 'text', 'blank', 'day', 'text'])
  })

  it('маркеры внутри подписи не остаются в тексте', () => {
    expect(parseTripPlanRichText('Ночь **Born**: своя кухня')[0]).toEqual({
      kind: 'text',
      inlines: [
        { text: 'Ночь Born:', bold: true, italic: false },
        { text: ' своя кухня', bold: false, italic: false },
      ],
    })
  })

  // Незакрытые `**` раньше просматривали строку до конца на каждом открытии:
  // 100 тыс. знаков «**a » разбирались ≈1,6 с.
  it('разбирает длинную строку с незакрытыми маркерами без квадратичного отката', () => {
    const value = `${'**a '.repeat(25000)}\n${' **_*a'.repeat(16000)}`
    const startedAt = process.hrtime.bigint()
    parseTripPlanRichText(value)
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    expect(elapsedMs).toBeLessThan(300)
  })

  it('текст без разметки остаётся одной обычной строкой', () => {
    expect(parseTripPlanRichText('Просто описание поездки')).toEqual([
      { kind: 'text', inlines: [{ text: 'Просто описание поездки', bold: false, italic: false }] },
    ])
  })
})

describe('extractTripPlanLinks и разметка', () => {
  // Блок «Ссылки» обязан вести туда же, куда ссылка в тексте: по сырой строке
  // чип получал адрес с хвостом `**`/`_`.
  it('не тянет маркеры жирного и курсива в адрес ссылки', () => {
    const links = extractTripPlanLinks('**Бронь https://booking.com/hotel**\n_см. https://example.com/map_')
    expect(links.map((link) => link.url)).toEqual(['https://booking.com/hotel', 'https://example.com/map'])
  })
})

describe('TripPlanLinkedText с разметкой', () => {
  const originalPlatform = Platform.OS
  afterEach(() => {
    Platform.OS = originalPlatform
  })

  it('убирает маркеры, выделяет жирный и курсив и оставляет ссылки ссылками', () => {
    Platform.OS = 'web'
    const { getByTestId, toJSON, UNSAFE_getAllByType, UNSAFE_getAllByProps } = render(
      <TripPlanLinkedText
        text={'ПО ДНЯМ\n**Бронь:** https://example.com/info\n_курсив_\n- пункт'}
        testID="desc"
        numberOfLines={2}
      />,
    )
    const root = getByTestId('desc')
    expect(root.props.numberOfLines).toBe(2)
    const texts = UNSAFE_getAllByType(Text)
    expect(texts.some((node) => node.props.style?.fontStyle === 'italic')).toBe(true)
    expect(texts.some((node) => node.props.style?.fontWeight === '700')).toBe(true)
    expect(UNSAFE_getAllByProps({ href: 'https://example.com/info' }).length).toBeGreaterThan(0)
    const plain = JSON.stringify(toJSON())
    expect(plain).not.toContain('**')
    expect(plain).not.toContain('_курсив_')
  })
})
