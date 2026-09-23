import fs from 'fs'
import path from 'path'
import type React from 'react'
import type { Root } from 'react-dom/client'

// #2036: hover-отклики жили ключом `':hover'` в стилях RN, а react-native-web 0.21
// компилирует его в `.r-:hover-…{:hover:[object Object];}` — правило, которое браузер
// отбрасывает. react-test-renderer видит объект стиля и проходит, поэтому здесь —
// настоящий DOM react-native-web: мышь наводится событием указателя, а стиль
// читается из `getComputedStyle`. Касание (`pointerType: 'touch'`) — mobile web:
// RNW не отдаёт ему `hovered`, и вид обязан остаться прежним.
//
// `__tests__/setup.ts` уже закэшировал свой мок `react-native`, поэтому RNW и всё,
// что через него рисуется, грузится из свежего реестра (рецепт #2024/#2032,
// `CompactSideBarTravel.dom.web.test.tsx`). jest-expo резолвит `.native` первым,
// так что `@/ui/paper` прибит к web-файлу.
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let translate: (key: string, params?: Record<string, unknown>) => string
let colors: Record<string, any>
let IconButton: React.ComponentType<any>
let Chip: React.ComponentType<any>
let AuthorBlock: React.ComponentType<any>
let createSidebarStyles: (themeColors: any) => any
let GalleryGrid: React.ComponentType<any>
let GalleryControls: React.ComponentType<any>
let DeleteAction: React.ComponentType<any>
let createGalleryStyles: (themeColors: any) => any
let PointListRow: React.ComponentType<any>
let ProgressIndicator: React.ComponentType<any>

jest.mock('@/components/ui/ImageCardMedia', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrlInNewTab: jest.fn(), openExternalUrl: jest.fn() }))
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    isSubscribed: false,
    isLoading: false,
    isMutating: false,
    toggleSubscription: jest.fn(),
    canSubscribe: true,
  }),
}))
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }))

// jsdom 20 не знает `PointerEvent`, а браузер (и `page.hover()` Playwright) шлёт именно
// его: без него RNW ушёл бы на ветку `mouseenter` и тип указателя не проверялся бы вовсе.
// Окружение у файла своё, поэтому замену не снимаем.
const installPointerEvent = () => {
  if (typeof (window as any).PointerEvent === 'function') return
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  ;(window as any).PointerEvent = PointerEventPolyfill
}

beforeAll(() => {
  installPointerEvent()
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/ui/paper', () => jest.requireActual('@/ui/paper.web.tsx'))
  // Настоящий `createIconSet` отдаёт все пропы в `<Text {...props}>` — так же
  // делает и эта замена; глобальный мок из `setup.ts` держит Text нативного реестра.
  jest.doMock('@expo/vector-icons/Feather', () => {
    const React = jest.requireActual('react')
    const { Text } = require('react-native')
    const Feather = ({ name, size: _size, color, style, ...props }: any) =>
      React.createElement(Text, { ...props, style: [{ color }, style] }, String(name))
    return { __esModule: true, default: Feather }
  })
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ translate } = require('@/i18n'))
  colors = require('@/hooks/useTheme').getThemedColors(false)
  IconButton = require('@/components/ui/IconButton').default
  Chip = require('@/components/ui/Chip').default
  ;({ AuthorBlock } = require('@/components/travel/compactSideBar/parts/AuthorBlock'))
  ;({ createStyles: createSidebarStyles } = require('@/components/travel/compactSideBar/styles'))
  ;({ GalleryGrid } = require('@/components/travel/gallery/GalleryGrid'))
  ;({ GalleryControls } = require('@/components/travel/gallery/GalleryControls'))
  ;({ DeleteAction } = require('@/components/travel/gallery/DeleteAction'))
  ;({ createGalleryStyles } = require('@/components/travel/gallery/styles'))
  PointListRow = require('@/components/travel/PointListRow').default
  ProgressIndicator = require('@/components/ui/ProgressIndicator').default
})

// Цвет в том виде, в каком его отдаёт `getComputedStyle`: jsdom переводит hex в rgb, а
// пробелы внутри `rgba(…)` зависят от источника (инлайн или правило RNW) — их снимаем.
const compactColor = (value: string) => value.replace(/\s+/g, '')
const cssColor = (value: string) => {
  const probe = document.createElement('div')
  probe.style.color = value
  return compactColor(probe.style.color)
}

describe('hover responses in the real React Native Web DOM (#2036)', () => {
  let container: HTMLDivElement
  let root: Root

  const render = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element)
    })
  }

  const node = (selector: string) => {
    const found = container.querySelector<HTMLElement>(selector)
    expect(found).not.toBeNull()
    return found as HTMLElement
  }

  // `pointerenter`/`pointerleave` не всплывают — RNW слушает их на самом узле.
  const pointer = async (
    target: Element,
    type: 'pointerenter' | 'pointerleave',
    pointerType: 'mouse' | 'touch' = 'mouse',
  ) => {
    await act(async () => {
      target.dispatchEvent(new (window as any).PointerEvent(type, { pointerType }))
    })
  }

  // Нажатие RNW ловит системой ответчиков (`mousedown`/`mouseup`), а `pressed` ставит
  // через `DEFAULT_PRESS_DELAY_MS` = 50 мс.
  const mousePress = async (target: Element, type: 'mousedown' | 'mouseup') => {
    await act(async () => {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mousedown' ? 1 : 0 }))
      await new Promise((resolve) => setTimeout(resolve, 80))
    })
  }

  const look = (target: Element) => {
    const style = window.getComputedStyle(target)
    return {
      background: compactColor(style.backgroundColor),
      border: compactColor(style.borderTopColor),
      transform: style.transform,
      opacity: style.opacity,
    }
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  describe('IconButton', () => {
    const renderIconButton = (props: Record<string, unknown> = {}) =>
      render(
        createElement(IconButton, {
          icon: createElement('span', null, 'i'),
          label: 'Поделиться',
          testID: 'icon-button',
          onPress: jest.fn(),
          showTooltip: false,
          ...props,
        }),
      )

    it('takes the soft surface and scales up under the mouse, and returns on leave', async () => {
      await renderIconButton()
      const button = node('[data-testid="icon-button"]')
      const idle = look(button)
      expect(idle.background).toBe(cssColor(colors.surface))
      expect(idle.transform).not.toContain('scale(1.05)')

      await pointer(button, 'pointerenter')
      expect(look(button).background).toBe(cssColor(colors.primarySoft))
      expect(look(button).transform).toContain('scale(1.05)')

      await pointer(button, 'pointerleave')
      expect(look(button)).toEqual(idle)
    })

    it('keeps its look for a touch pointer (mobile web) and when disabled', async () => {
      await renderIconButton()
      const button = node('[data-testid="icon-button"]')
      const idle = look(button)
      await pointer(button, 'pointerenter', 'touch')
      expect(look(button)).toEqual(idle)

      await renderIconButton({ disabled: true })
      const disabled = node('[data-testid="icon-button"]')
      const disabledIdle = look(disabled)
      await pointer(disabled, 'pointerenter')
      expect(look(disabled)).toEqual(disabledIdle)
    })

    it('keeps the primary fill of an active button and only scales it', async () => {
      await renderIconButton({ active: true })
      const button = node('[data-testid="icon-button"]')
      expect(look(button).background).toBe(cssColor(colors.primary))
      await pointer(button, 'pointerenter')
      expect(look(button).background).toBe(cssColor(colors.primary))
      expect(look(button).transform).toContain('scale(1.05)')
    })
  })

  describe('Chip', () => {
    const renderChip = (props: Record<string, unknown> = {}) =>
      render(createElement(Chip, { label: 'Горы', testID: 'chip', onPress: jest.fn(), ...props }))

    it('scales up under the mouse and returns on leave', async () => {
      await renderChip()
      const chip = node('[data-testid="chip"]')
      const idle = look(chip)
      expect(idle.transform).not.toContain('scale(1.05)')

      await pointer(chip, 'pointerenter')
      expect(look(chip).transform).toContain('scale(1.05)')

      await pointer(chip, 'pointerleave')
      expect(look(chip)).toEqual(idle)
    })

    it('keeps its look for a touch pointer (mobile web) and when disabled', async () => {
      await renderChip()
      const chip = node('[data-testid="chip"]')
      const idle = look(chip)
      await pointer(chip, 'pointerenter', 'touch')
      expect(look(chip)).toEqual(idle)

      await renderChip({ disabled: true })
      const disabled = node('[data-testid="chip"]')
      const disabledIdle = look(disabled)
      await pointer(disabled, 'pointerenter')
      expect(look(disabled)).toEqual(disabledIdle)
    })
  })

  describe('author card action buttons (response intended in #2032)', () => {
    it('edit, PDF, subscribe and write take the `border` frame under the mouse', async () => {
      const displayName = 'Юлия'
      await render(
        createElement(AuthorBlock, {
          styles: createSidebarStyles(colors),
          colors,
          textColor: colors.text,
          mutedText: colors.textMuted,
          avatarUri: '',
          userName: displayName,
          authorUserId: '7',
          canEdit: true,
          isOwn: false,
          travel: { id: 1, slug: 'trip', name: 'Поездка' },
          whenLine: '',
          views: null,
          onOpenProfile: jest.fn(),
          onEdit: jest.fn(),
          onWrite: jest.fn(),
        }),
      )
      const labels = [
        translate('travel:components.travel.compactSideBar.parts.AuthorBlock.redaktirovat_puteshestvie_8010aa7b'),
        translate('travel:components.travel.TravelPdfExportControl.eksport_v_pdf_94c24fb3'),
        translate('shared:components.ui.SubscribeButton.podpisatsya_na_polzovatelya_f873c74c'),
        translate('travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_value1_191ed8f0', {
          value1: displayName,
        }),
      ]
      for (const label of labels) {
        const button = node(`[aria-label="${label}"]`)
        const idle = look(button)
        expect({ label, border: idle.border }).toEqual({ label, border: cssColor(colors.borderLight) })

        await pointer(button, 'pointerenter')
        expect({ label, ...look(button) }).toEqual({
          label,
          ...idle,
          background: cssColor(colors.backgroundSecondary),
          border: cssColor(colors.border),
        })

        await pointer(button, 'pointerleave', 'mouse')
        expect(look(button)).toEqual(idle)

        await pointer(button, 'pointerenter', 'touch')
        expect(look(button)).toEqual(idle)
      }
    })
  })

  describe('gallery photo buttons', () => {
    const image = (id: string) => ({ id, stableKey: id, url: `https://example.test/${id}.jpg`, hasLoaded: true })

    it('delete and enabled move arrows respond to the mouse, a disabled arrow does not', async () => {
      await render(
        createElement(GalleryGrid, {
          styles: createGalleryStyles(colors),
          colors,
          isInitialLoading: false,
          images: [image('a'), image('b')],
          onDelete: jest.fn(),
          onMove: jest.fn(),
          onImageError: jest.fn(),
          onImageLoad: jest.fn(),
          onCaptionChange: jest.fn(),
          selectedKeys: new Set(),
          onToggleSelect: jest.fn(),
          isMobileWeb: false,
          DeleteAction,
        }),
      )
      const firstCard = container.querySelectorAll('[data-testid="gallery-image"]')[0]
      const deleteButton = firstCard.querySelector('[data-testid="delete-image-button"]') as HTMLElement
      const leftArrow = firstCard.querySelector('[data-testid="gallery-move-left-button"]') as HTMLElement
      const rightArrow = firstCard.querySelector('[data-testid="gallery-move-right-button"]') as HTMLElement

      const deleteIdle = look(deleteButton)
      await pointer(deleteButton, 'pointerenter')
      expect(look(deleteButton).transform).toContain('scale(1.1)')
      expect(look(deleteButton).background).toBe(cssColor(colors.dangerDark))
      // `':active'` задумывался как сжатие при нажатии — только под курсором мыши.
      await mousePress(deleteButton, 'mousedown')
      expect(look(deleteButton).transform).toContain('scale(0.95)')
      await mousePress(deleteButton, 'mouseup')
      await pointer(deleteButton, 'pointerleave')
      expect(look(deleteButton)).toEqual(deleteIdle)

      const rightIdle = look(rightArrow)
      await pointer(rightArrow, 'pointerenter', 'touch')
      expect(look(rightArrow)).toEqual(rightIdle)
      await pointer(rightArrow, 'pointerenter')
      expect(look(rightArrow).transform).toContain('scale(1.05)')

      // У первого кадра «влево» выключена: наведение не обещает действие, которого нет.
      const leftIdle = look(leftArrow)
      await pointer(leftArrow, 'pointerenter')
      expect(look(leftArrow)).toEqual(leftIdle)
    })
  })

  describe('CSS rules on dataSet markers (no Pressable state to hang the response on)', () => {
    const MARKERS = ['data-point-list-row', 'data-point-list-icon', 'data-gallery-dropzone', 'data-progress-cancel']

    type MarkerRule = { selector: string; media: string | null }

    // Все правила `app/global.css`, чьи селекторы трогают маркеры #2036.
    const readMarkerRules = (): MarkerRule[] => {
      const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')
      const style = document.createElement('style')
      style.textContent = css
      document.head.appendChild(style)
      const rules: MarkerRule[] = []
      const walk = (list: CSSRuleList, media: string | null) => {
        for (const rule of Array.from(list)) {
          if ('selectorText' in rule) {
            for (const selector of (rule as CSSStyleRule).selectorText.split(',')) {
              if (MARKERS.some((marker) => selector.includes(`[${marker}`))) {
                rules.push({ selector: selector.trim(), media })
              }
            }
          } else if ('cssRules' in rule && 'media' in rule) {
            walk((rule as CSSMediaRule).cssRules, (rule as CSSMediaRule).media.mediaText)
          }
        }
      }
      walk((style.sheet as CSSStyleSheet).cssRules, null)
      style.remove()
      return rules
    }

    const renderMarkedSurfaces = () =>
      render(
        createElement(
          'div',
          null,
          createElement(PointListRow, {
            point: { id: '7', address: 'Замок Мир', coord: '53.4513, 26.4728' },
            index: 0,
            styles: {},
            colors: { primary: colors.primary, primaryDark: colors.primaryDark, textMuted: colors.textMuted },
            onCardPress: jest.fn(),
            onCopy: jest.fn(),
            onOpenMap: jest.fn(),
            onShare: jest.fn(),
          }),
          createElement(ProgressIndicator, { progress: 40, onCancel: jest.fn() }),
          createElement(GalleryControls, {
            styles: createGalleryStyles(colors),
            colors,
            imagesCount: 0,
            maxImages: 20,
            isMobileWeb: false,
            isDragActive: false,
            isUploading: false,
            dropzone: { rootProps: {}, tabIndex: 0 },
            inputProps: {},
            batchUploadProgress: null,
            hasErrors: false,
            selectableCount: 0,
            selectedCount: 0,
            allSelected: false,
            onSelectFromGallery: jest.fn(),
            onTakePhoto: jest.fn(),
            onToggleSelectAll: jest.fn(),
            onDeleteSelected: jest.fn(),
          }),
        ),
      )

    it('puts every marker into the DOM through dataSet', async () => {
      await renderMarkedSurfaces()
      expect(container.querySelectorAll('[data-point-list-row="true"]')).toHaveLength(1)
      // «Скопировать координаты» и «Поделиться в Telegram».
      expect(container.querySelectorAll('[data-point-list-icon="true"]')).toHaveLength(2)
      expect(container.querySelectorAll('[data-gallery-dropzone="true"]')).toHaveLength(1)
      expect(node('[data-progress-cancel="true"]').textContent).toBe(
        translate('shared:components.ui.ProgressIndicator.otmenit_ac1629b1'),
      )
    })

    it('has a mouse-only hover rule in app/global.css for every marker, and each reaches rendered elements', async () => {
      await renderMarkedSurfaces()
      const rules = readMarkerRules()
      expect(MARKERS.filter((marker) => !rules.some((rule) => rule.selector.includes(`[${marker}`)))).toEqual([])

      // RULES.md: hover-only affordances are desktop-only — правило живёт только под
      // `(hover: hover) and (pointer: fine)`, касание его не получает.
      const outsideHoverMedia = rules
        .filter((rule) => !(String(rule.media).includes('hover: hover') && String(rule.media).includes('pointer: fine')))
        .map((rule) => rule.selector)
      expect(outsideHoverMedia).toEqual([])
      expect(rules.every((rule) => rule.selector.includes(':hover'))).toBe(true)

      // jsdom никого не «наводит»: без `:hover` селектор — это множество элементов,
      // которые правило перекрасит при наведении. Пустое множество — мёртвое правило.
      const deadSelectors = rules
        .map((rule) => rule.selector)
        .filter((selector) => container.querySelectorAll(selector.replace(/:hover/g, '')).length === 0)
      expect(deadSelectors).toEqual([])
    })
  })
})
