// #2229 (находка поезда 9): названия и описания пресетов и категорий окна
// настроек книги шли русскими литералами — на PL-сайте «Минимализм», «Детальные»
// и т. д. Подписи берутся из `@/i18n` и общие для окна сайта и нативного окна.
import React from 'react'
import { render } from '@testing-library/react-native'

import PresetSelector from '@/components/export/PresetSelector'
import { i18n, type SupportedLocale } from '@/i18n'
import { BOOK_PRESETS, PRESET_CATEGORIES } from '@/types/pdf-presets'

const CYRILLIC = /[А-Яа-яЁёІіЎўЇїЄєҐґ]/

afterAll(async () => {
  await i18n.changeLanguage('ru')
})

describe('пресеты PDF-книги переводятся', () => {
  it.each(['pl', 'en'] as SupportedLocale[])('%s: в названиях и описаниях нет кириллицы', async (locale) => {
    await i18n.changeLanguage(locale)
    const labels = [
      ...BOOK_PRESETS.flatMap((preset) => [preset.name, preset.description]),
      ...Object.values(PRESET_CATEGORIES).flatMap((category) => [category.name, category.description]),
    ]
    expect(labels.filter((label) => CYRILLIC.test(label) || label.includes('pdfPresets.'))).toEqual([])
  })

  it.each(['ru', 'be', 'uk', 'pl', 'en'] as SupportedLocale[])('%s: у каждого пресета и категории своя подпись', async (locale) => {
    await i18n.changeLanguage(locale)
    for (const preset of BOOK_PRESETS) {
      expect(preset.name).not.toMatch(/^common:|pdfPresets\./)
      expect(preset.description.length).toBeGreaterThan(10)
    }
    expect(new Set(Object.values(PRESET_CATEGORIES).map((category) => category.name)).size).toBe(5)
  })

  it('PL: выбиралка «Быстрый старт» показывает польские категории и пресеты', async () => {
    await i18n.changeLanguage('pl')
    const view = render(<PresetSelector onPresetSelect={jest.fn()} showCategories />)

    expect(view.getByText('Minimalizm')).toBeTruthy()
    expect(view.getByText('Szczegółowe')).toBeTruthy()
    expect(view.getByText('Minimalista')).toBeTruthy()
    expect(view.queryByText('Минимализм')).toBeNull()
    expect(view.queryByText('Детальные')).toBeNull()
  })
})
