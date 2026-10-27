import type React from 'react'
import type { Travel } from '@/types/types'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let ProfileTravelGrid: React.ComponentType<any>
let TravelModerationFeedback: React.ComponentType<any>
let createProfileScreenStyles: (args: Record<string, unknown>) => Record<string, unknown>
let changeLanguage: (locale: string) => Promise<unknown>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/profile' }))
  // Only media and unrelated actions are replaced. The real grid, owner opt-in,
  // card wrapper, feedback, status chip and Button export their actual CSS.
  jest.doMock('@/components/ui/UnifiedTravelCard', () => {
    const react = require('react')
    return { __esModule: true, default: ({ testID, contentSlot }: { testID: string; contentSlot: React.ReactNode }) =>
      react.createElement('div', { 'data-testid': testID }, contentSlot) }
  })
  jest.doMock('@/components/travel/FavoriteButton', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/travel/TravelStatusButton', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/safety/ContentSafetyActions', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/hooks/useHiddenContent', () => ({ useHiddenContent: () => ({ hidden: false, unhide: jest.fn() }) }))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ ProfileTravelGrid } = require('@/components/screens/profile/ProfileTravelGrid'))
  ;({ createProfileScreenStyles } = require('@/components/screens/profile/profileScreen.styles'))
  TravelModerationFeedback = require('@/components/travel/TravelModerationFeedback').default
  const { i18n } = require('@/i18n')
  changeLanguage = (locale) => i18n.changeLanguage(locale)
})

afterEach(async () => { await changeLanguage('ru') })

const metadata = {
  moderation_decision: 'rejected' as const,
  moderation_decision_reason: 'First reason line.\nSecond reason line.',
  moderation_decided_at: '2026-10-21T09:15:00Z',
}
const travels = [
  { publication_status: 'draft', ...metadata },
  { publication_status: 'draft', ...metadata, moderation_decision_reason: 'Short reason.' },
  { publication_status: 'published', ...metadata, moderation_decision: 'approved' },
  { publication_status: 'draft', ...metadata, moderation_decision: 'approved' },
  { publication_status: 'draft', ...metadata, moderation_decision_reason: '', moderation_decided_at: null },
  { publication_status: 'pending_review', ...metadata },
].map((state, index) => ({ id: index + 1, slug: `geometry-${index}`, name: `Travel ${index}`, userIds: '7', countryName: '', ...state } as Travel))

const pixels = (node: Element, property: keyof CSSStyleDeclaration): number => {
  const value = Number.parseFloat(String(getComputedStyle(node)[property]))
  expect(Number.isFinite(value)).toBe(true)
  return value
}

const verticalEdges = (node: Element) => pixels(node, 'paddingTop') + pixels(node, 'paddingBottom')
  + pixels(node, 'borderTopWidth') + pixels(node, 'borderBottomWidth')

describe('author-list collapsed feedback geometry across independent rows', () => {
  it.each(['ru', 'be', 'uk', 'pl', 'en'])('exports one content-based floor for every state and row in %s', async (locale) => {
    await changeLanguage(locale)
    for (const cols of [1, 2]) {
      const host = document.createElement('div')
      host.style.width = cols === 1 ? '390px' : '1440px'
      document.body.appendChild(host)
      const root = createRoot(host)
      await act(async () => root.render(createElement(ProfileTravelGrid, {
        currentData: travels,
        styles: createProfileScreenStyles({ colors: { background: '#fff' }, contentPadding: 12, gapSize: 8,
          isDesktopWeb: cols > 1, maxContentWidth: 1280 }),
        isCardsSingleColumn: cols === 1, gridColumns: cols, gapSize: 8, isMobileDevice: cols === 1,
        userId: '7', isSuperuser: false, activeTab: 'travels', handleDeleteMyTravel: jest.fn(),
        width: cols === 1 ? 390 : 1440, removingTravelId: null,
      })))
      try {
        const footers = Array.from(host.querySelectorAll<HTMLElement>('[data-testid="travel-moderation-feedback"]'))
        expect(footers).toHaveLength(travels.length)
        // These records occupy different flex rows, so alignItems:stretch alone
        // cannot establish a list-wide minimum.
        const rowOf = (footer: Element) => {
          let row = footer.parentElement
          while (row && getComputedStyle(row).flexDirection !== 'row') row = row.parentElement
          return row
        }
        expect(rowOf(footers[0])).not.toBeNull()
        expect(rowOf(footers[0])).not.toBe(rowOf(footers[2]))
        const floor = pixels(footers[0], 'minHeight')
        expect(floor).toBeGreaterThan(0)
        for (const footer of footers) {
          expect(pixels(footer, 'minHeight')).toBe(floor)
          expect(getComputedStyle(footer).height).not.toMatch(/[1-9]/)
          expect(getComputedStyle(footer).maxHeight).not.toMatch(/[1-9]/)
          expect(getComputedStyle(footer).overflow).not.toBe('hidden')
        }

        const full = footers[0]
        const chip = full.firstElementChild!
        const preview = full.querySelector('[data-testid="moderation-reason-preview"]')!
        const reasonLabel = preview.previousElementSibling!
        const details = full.querySelector('[data-testid="moderation-reason-expand"]')!
        const date = full.querySelector('[data-testid="moderation-decision-date"]')!
        const correction = full.querySelector('[data-testid="moderation-correct-button"]')!
        const correctionLabel = correction.firstElementChild!.lastElementChild!
        // Read the real RNW CSS rather than reproducing the implementation's
        // constants. The floor covers two preview/date/action lines and every
        // visible control's padding, border and touch target. jsdom does not
        // measure text or browser flex layout; production must prove the bounds.
        const required = verticalEdges(full) + 3 * pixels(full, 'gap')
          + pixels(chip.firstElementChild!, 'lineHeight') + verticalEdges(chip)
          + pixels(reasonLabel, 'lineHeight') + 2 * pixels(preview, 'lineHeight')
          + Math.max(pixels(details, 'minHeight'), pixels(details.firstElementChild!, 'lineHeight') + verticalEdges(details))
          + 2 * pixels(date, 'lineHeight')
          + Math.max(pixels(correction, 'minHeight'), 2 * pixels(correctionLabel, 'lineHeight') + verticalEdges(correction))
        expect(floor).toBeGreaterThanOrEqual(required)
        expect(pixels(preview, 'minHeight')).toBeGreaterThanOrEqual(2 * pixels(preview, 'lineHeight'))
        for (const footer of footers.slice(2)) {
          expect(footer.querySelector('[data-testid="moderation-reason-preview"]')).toBeNull()
          expect(footer.querySelector('[data-testid="moderation-reason-expand"]')).toBeNull()
        }
        expect(footers[3].querySelector('[data-testid="moderation-decision-date"]')).toBeNull()
        expect(footers[4].querySelector('[data-testid="moderation-decision-date"]')).toBeNull()
      } finally { await act(async () => root.unmount()); host.remove() }
    }
  })

  it('reserves only the slots present in the list, so a drafts-only list has no dead footer (#2815)', async () => {
    const renderGrid = async (currentData: Travel[]) => {
      const host = document.createElement('div')
      host.style.width = '1440px'
      document.body.appendChild(host)
      const root = createRoot(host)
      await act(async () => root.render(createElement(ProfileTravelGrid, {
        currentData,
        styles: createProfileScreenStyles({ colors: { background: '#fff' }, contentPadding: 12, gapSize: 8,
          isDesktopWeb: true, maxContentWidth: 1280 }),
        isCardsSingleColumn: false, gridColumns: 2, gapSize: 8, isMobileDevice: false,
        userId: '7', isSuperuser: false, activeTab: 'travels', handleDeleteMyTravel: jest.fn(),
        width: 1440, removingTravelId: null,
      })))
      const footers = Array.from(host.querySelectorAll<HTMLElement>('[data-testid="travel-moderation-feedback"]'))
      const floors = footers.map((footer) => pixels(footer, 'minHeight'))
      const chipOnly = verticalEdges(footers[0]) + pixels(footers[0].firstElementChild!.firstElementChild!, 'lineHeight')
        + verticalEdges(footers[0].firstElementChild!)
      await act(async () => root.unmount())
      host.remove()
      return { floors, chipOnly }
    }
    const plain = (id: number, publication_status: string) =>
      ({ id, slug: `plain-${id}`, name: `Plain ${id}`, userIds: '7', countryName: '', publication_status } as Travel)
    const drafts = await renderGrid([plain(91, 'draft'), travels[5], plain(92, 'draft')])
    expect(new Set(drafts.floors).size).toBe(1)
    expect(drafts.floors[0]).toBe(drafts.chipOnly)

    const approved = await renderGrid([travels[2], plain(93, 'draft')])
    expect(new Set(approved.floors).size).toBe(1)
    expect(approved.floors[0]).toBeGreaterThan(approved.chipOnly)

    const full = await renderGrid(travels)
    expect(full.floors[0]).toBeGreaterThan(approved.floors[0])
  })

  it('does not reserve the authored-card floor in the wizard', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => root.render(createElement(TravelModerationFeedback, { travel: travels[0] })))
    try {
      const feedback = host.querySelector('[data-testid="travel-moderation-feedback"]')!
      expect(getComputedStyle(feedback).minHeight).not.toMatch(/[1-9]/)
    } finally { await act(async () => root.unmount()); host.remove() }
  })
})
