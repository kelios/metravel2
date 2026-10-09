/** @jest-environment node */
import path from 'path'
import ts from 'typescript'

import { SUPPORTED_LOCALES } from '@/i18n/config'
import {
  DEFAULT_CHECKLIST_SELECTION as legacyChecklistSelection,
  defaultBookSettings,
} from '@/components/export/BookSettingsModal.constants'
import { PDF_THEMES } from '@/services/pdf-export/themes/PdfThemeConfig'
import {
  BOOK_SETTINGS_LOCALES,
  BOOK_SETTINGS_SCHEMA_VERSION,
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_CHECKLIST_SELECTION,
  toBookSettingsDto,
} from '@/types/bookSettings'
import type { BookSettings, BookSettingsDto } from '@/types/bookSettings'

const minimalSettings: BookSettings = {
  title: 'Путешествия',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'manual',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  includeChecklists: false,
  checklistSections: ['documents'],
}

const legacyUiDefaults: BookSettings = {
  title: '',
  subtitle: '',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'manual',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  showCoordinatesOnMapPage: true,
  includeChecklists: false,
  checklistSections: ['clothing', 'food', 'electronics'],
  galleryLayout: 'grid',
  galleryColumns: 3,
  galleryPhotosPerPage: 2,
  galleryTwoPerPageLayout: 'vertical',
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}

const expectedWireDefaults: BookSettingsDto = {
  ...minimalSettings,
  subtitle: '',
  coverImage: '',
  showCoordinatesOnMapPage: true,
  galleryLayout: 'grid',
  galleryColumns: 3,
  galleryPhotosPerPage: 2,
  galleryTwoPerPageLayout: 'vertical',
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
  photoPageLayout: 'full-bleed',
  locale: 'RU',
}

describe('canonical book settings and B1 settings schema v1', () => {
  it('preserves the complete legacy UI defaults through compatibility exports', () => {
    expect(DEFAULT_BOOK_SETTINGS).toStrictEqual(legacyUiDefaults)
    expect(defaultBookSettings).toBe(DEFAULT_BOOK_SETTINGS)
    expect(legacyChecklistSelection).toBe(DEFAULT_CHECKLIST_SELECTION)
    expect(DEFAULT_CHECKLIST_SELECTION).toEqual(['clothing', 'food', 'electronics'])
    // These are wire defaults, not new fields in the legacy UI initial state.
    expect(DEFAULT_BOOK_SETTINGS).not.toHaveProperty('coverImage')
    expect(DEFAULT_BOOK_SETTINGS).not.toHaveProperty('photoPageLayout')
    expect(DEFAULT_BOOK_SETTINGS).not.toHaveProperty('locale')
  })

  it('fills omitted optional values for the strict wire schema without UI-only fields', () => {
    const input = { ...minimalSettings, previewUrl: 'blob:ui-preview' }
    expect(BOOK_SETTINGS_SCHEMA_VERSION).toBe(1)
    expect(toBookSettingsDto(input, 'RU')).toStrictEqual(expectedWireDefaults)
    expect(input).not.toHaveProperty('photoPageLayout')
    expect(input).not.toHaveProperty('locale')
  })

  it('preserves explicitly disabled sections, empty strings and the all-photos zero sentinel', () => {
    const settings: BookSettings = {
      ...minimalSettings,
      title: '',
      subtitle: '',
      coverImage: '',
      includeToc: false,
      includeGallery: false,
      includeMap: false,
      showCoordinatesOnMapPage: false,
      includeChecklists: false,
      checklistSections: [],
      galleryColumns: 2,
      galleryPhotosPerPage: 0,
      showCaptions: false,
      captionPosition: 'none',
    }
    expect(toBookSettingsDto(settings, 'EN')).toStrictEqual({
      ...expectedWireDefaults,
      ...settings,
      locale: 'EN',
    })
  })

  it('copies checklist selection so subsequent form edits cannot mutate the wire payload', () => {
    const settings: BookSettings = { ...minimalSettings, checklistSections: ['documents', 'medicine'] }
    const dto = toBookSettingsDto(settings, 'PL')
    expect(dto.checklistSections).toEqual(['documents', 'medicine'])
    expect(dto.checklistSections).not.toBe(settings.checklistSections)
    settings.checklistSections.push('food')
    expect(dto.checklistSections).toEqual(['documents', 'medicine'])
    dto.checklistSections.reverse()
    expect(settings.checklistSections).toEqual(['documents', 'medicine', 'food'])
  })

  it('keeps all 20 registered themes selectable and does not downgrade premium settings', () => {
    expect(Object.keys(PDF_THEMES).sort()).toEqual([
      'adventure', 'black-white', 'classic', 'dark', 'editorial-luxe', 'forest',
      'illustrated', 'light', 'minimal', 'modern', 'newspaper', 'nordic',
      'ocean', 'retro', 'romantic', 'sepia', 'sunset', 'travel-magazine',
      'tropical', 'watercolor',
    ])
    for (const theme of Object.values(PDF_THEMES)) {
      expect(toBookSettingsDto({ ...minimalSettings, template: theme.name }, 'BE').template).toBe(theme.name)
    }
    const premium: BookSettings = {
      ...minimalSettings,
      template: 'editorial-luxe',
      coverType: 'custom',
      coverImage: 'https://example.com/frozen-cover.webp',
      galleryLayout: 'collage',
      captionPosition: 'overlay',
    }
    expect(toBookSettingsDto(premium, 'BE')).toMatchObject(premium)
  })

  it.each(['grid', 'masonry', 'collage', 'polaroid', 'slideshow'] as const)(
    'preserves gallery layout %s',
    (galleryLayout) => {
      expect(toBookSettingsDto({ ...minimalSettings, galleryLayout }, 'RU').galleryLayout).toBe(galleryLayout)
    },
  )

  it.each(['bottom', 'top', 'overlay', 'none'] as const)('preserves caption position %s', (captionPosition) => {
    expect(toBookSettingsDto({ ...minimalSettings, captionPosition }, 'RU').captionPosition).toBe(captionPosition)
  })

  it.each(['manual', 'date-desc', 'date-asc', 'country', 'alphabetical'] as const)(
    'preserves finalized selection sort order %s',
    (sortOrder) => {
      expect(toBookSettingsDto({ ...minimalSettings, sortOrder }, 'RU').sortOrder).toBe(sortOrder)
    },
  )

  it.each(['full-bleed', 'framed', 'split'] as const)('preserves photo-page layout %s', (photoPageLayout) => {
    expect(toBookSettingsDto({ ...minimalSettings, photoPageLayout }, 'RU').photoPageLayout).toBe(photoPageLayout)
  })

  it.each(['vertical', 'horizontal'] as const)('preserves two-photo orientation %s', (galleryTwoPerPageLayout) => {
    expect(toBookSettingsDto({ ...minimalSettings, galleryTwoPerPageLayout }, 'RU').galleryTwoPerPageLayout)
      .toBe(galleryTwoPerPageLayout)
  })

  it.each(['compact', 'normal', 'spacious'] as const)('preserves gallery spacing %s', (gallerySpacing) => {
    expect(toBookSettingsDto({ ...minimalSettings, gallerySpacing }, 'RU').gallerySpacing).toBe(gallerySpacing)
  })

  it('keeps the declared theme/gallery/locale unions and all wire fields required', () => {
    // Jest strips types: inspect the real TypeScript contract to catch a narrowed
    // theme union or accidentally optional DTO field as well as runtime regressions.
    const root = path.resolve(__dirname, '../../..')
    const settingsFile = path.join(root, 'types/bookSettings.ts')
    const program = ts.createProgram([settingsFile], {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      baseUrl: root,
      paths: { '@/*': ['./*'] },
      types: [],
      strictNullChecks: true,
      skipLibCheck: true,
    })
    const source = program.getSourceFile(settingsFile)
    if (!source) throw new Error('Canonical settings source was not loaded')
    const checker = program.getTypeChecker()
    const typeFor = (name: string) => {
      const declaration = source.statements.find((node) =>
        (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text === name,
      )
      if (!declaration) throw new Error(`Missing contract declaration: ${name}`)
      return checker.getTypeAtLocation(declaration)
    }
    const literalValues = (type: ts.Type): string[] =>
      (type.isUnion() ? type.types : [type])
        .filter((variant): variant is ts.StringLiteralType => Boolean(variant.flags & ts.TypeFlags.StringLiteral))
        .map((variant) => variant.value)
        .sort()
    const settingsType = typeFor('BookSettings')
    const valuesFor = (property: string) => {
      const symbol = settingsType.getProperty(property)
      if (!symbol) throw new Error(`Missing settings field: ${property}`)
      return literalValues(checker.getTypeOfSymbolAtLocation(symbol, source))
    }
    expect(valuesFor('template')).toEqual(Object.keys(PDF_THEMES).sort())
    expect(valuesFor('galleryLayout')).toEqual(['collage', 'grid', 'masonry', 'polaroid', 'slideshow'])
    expect(valuesFor('captionPosition')).toEqual(['bottom', 'none', 'overlay', 'top'])
    expect(literalValues(typeFor('BookSettingsLocale'))).toEqual([...BOOK_SETTINGS_LOCALES].sort())
    const dtoProperties = typeFor('BookSettingsDto').getProperties()
    expect(dtoProperties.map((property) => property.name).sort()).toEqual(Object.keys(expectedWireDefaults).sort())
    expect(dtoProperties.filter((property) => property.flags & ts.SymbolFlags.Optional).map((property) => property.name))
      .toEqual([])
  })

  it('uses the uppercase wire counterparts of all production locales', () => {
    expect(BOOK_SETTINGS_LOCALES).toEqual(['RU', 'BE', 'UK', 'PL', 'EN'])
    expect(BOOK_SETTINGS_LOCALES).toEqual(SUPPORTED_LOCALES.map((locale) => locale.toUpperCase()))
    for (const locale of BOOK_SETTINGS_LOCALES) {
      expect(toBookSettingsDto(minimalSettings, locale).locale).toBe(locale)
    }
  })
})
