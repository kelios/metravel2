import React from 'react'
import { render, act, fireEvent, waitFor } from '@testing-library/react-native'
import MapPageComponent from '@/components/MapPage/Map.web'

// Mock leaflet modules
const mockLeaflet = {
  Icon: jest.fn().mockImplementation((options: any) => ({
    options,
    _getIconUrl: jest.fn(),
  })),
  latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
  latLngBounds: jest.fn((points: any[]) => ({
    pad: jest.fn((padding: number) => ({ pad: padding })),
  })),
}

// Mock window object and matchMedia
Object.defineProperty(window, 'window', {
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    matchMedia: jest.fn(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    L: mockLeaflet,
  },
  writable: true,
})

if (!window.matchMedia) {
  ;(window as any).matchMedia = jest.fn(() => ({
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }))
}

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 53.9, longitude: 27.5667 },
    })
  ),
  Accuracy: {
    BestForNavigation: 6,
  },
}))

// Mock leaflet CSS import
jest.mock('leaflet/dist/leaflet.css', () => ({}), { virtual: true })

// Mock leaflet module
jest.mock('leaflet', () => ({
  __esModule: true,
  default: mockLeaflet,
}))

// Mock react-leaflet module
jest.mock('react-leaflet', () => {
  return {
    MapContainer: ({ children, ...props }: any) => <div data-testid="map-container" {...props}>{children}</div>,
    TileLayer: (props: any) => <div data-testid="tile-layer" {...props} />,
    Circle: (props: any) => {
      ;(globalThis as any).lastCircleProps = props
      return <div data-testid="circle" {...props} />
    },
    Marker: (props: any) => {
      // Сохраняем eventHandlers для тестирования
      if (props.eventHandlers?.click) {
        (globalThis as any).lastMarkerClickHandler = props.eventHandlers.click
      }
      return <div data-testid="marker" {...props} />
    },
    Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
    useMap: jest.fn(() => ({
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      latLngToContainerPoint: jest.fn(() => ({ x: 0, y: 0 })),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      getZoom: jest.fn(() => 11),
      on: jest.fn(),
      off: jest.fn(),
    })),
    useMapEvents: jest.fn(),
  }
})

// Mock RoutingMachine component
jest.mock('@/components/MapPage/RoutingMachine', () => {
  return function RoutingMachine() {
    return <div data-testid="routing-machine" />
  }
})

// Mock PopupContentComponent
jest.mock('@/components/MapPage/PopupContentComponent', () => {
  return function PopupContentComponent() {
    return <div data-testid="popup-content" />
  }
})

describe('MapPageComponent (Map.web.tsx)', () => {
  const defaultProps = {
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    routePoints: [] as [number, number][],
    setRoutePoints: jest.fn(),
    onMapClick: jest.fn(),
    mode: 'radius' as const,
    transportMode: 'car' as const,
    setRouteDistance: jest.fn(),
    setFullRouteCoords: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset window.L
    ;(window as any).L = mockLeaflet
    // Reset marker click handler
    delete (window as any).lastMarkerClickHandler
  })

  it('renders loading state initially', async () => {
    const { getByText } = render(<MapPageComponent {...defaultProps} />)
    expect(getByText(/Loading map/i)).toBeTruthy()
    await act(async () => {})
  })

  it('does not use require() with template literals', () => {
    // This test ensures that the code doesn't contain dynamic require() calls
    // which would cause build-time errors like: require(`@/assets/icons/${iconName}`)
    const fs = require('fs')
    const path = require('path')
    const filePath = path.join(__dirname, '../../components/MapPage/Map.web.tsx')
    
    if (!fs.existsSync(filePath)) {
      // Skip if file doesn't exist (e.g., in some test environments)
      return
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8')
    
    // Check that there are no require() calls with template literals
    // Pattern matches: require(`...${...}...`) or require('...${...}...')
    const dynamicRequirePattern = /require\s*\(\s*[`'"].*?\$\{[^}]+\}.*?[`'"]\s*\)/
    const matches = fileContent.match(dynamicRequirePattern)
    
    if (matches) {
      console.error('Found dynamic require() calls with template literals:', matches)
    }
    expect(matches).toBeNull()
  })

  it('uses static icon mapping instead of dynamic require', () => {
    const fs = require('fs')
    const path = require('path')
    const filePath = path.join(__dirname, '../../components/MapPage/Map.web.tsx')
    
    if (!fs.existsSync(filePath)) {
      return
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8')
    
    // Check that iconMap is defined
    expect(fileContent).toContain('iconMap')
    expect(fileContent).toContain("'marker.ico'")
    expect(fileContent).toContain("'user_location.ico'")
    expect(fileContent).toContain("'start.ico'")
    expect(fileContent).toContain("'end.ico'")
    
    // Ensure no template literal in require (backtick version)
    const templateLiteralRequire = /require\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/
    expect(fileContent).not.toMatch(templateLiteralRequire)
    
    // Ensure no template literal in require (single quote version)
    const templateLiteralRequireSingle = /require\s*\(\s*'[^']*\$\{[^}]+\}[^']*'\s*\)/
    expect(fileContent).not.toMatch(templateLiteralRequireSingle)
  })

  it('handles missing leaflet modules gracefully', async () => {
    // Component should handle leaflet integration without crashing in test environment
    const result = render(<MapPageComponent {...defaultProps} />)
    await act(async () => {})

    // Достаточно того, что рендер отработал без исключений
    expect(result).toBeTruthy()
  })

  it('does not zoom when clicking on route start/finish markers', async () => {
    const props = {
      ...defaultProps,
      mode: 'route' as const,
      routePoints: [[27.5667, 53.9], [27.5767, 53.91]] as [number, number][],
    }
    const { useMap } = require('react-leaflet')
    const mockFitBounds = jest.fn()
    const mockSetView = jest.fn()
    useMap.mockReturnValue({
      fitBounds: mockFitBounds,
      setView: mockSetView,
      closePopup: jest.fn(),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      getZoom: jest.fn(() => 11),
      on: jest.fn(),
      off: jest.fn(),
    })
    
    render(<MapPageComponent {...props} />)
    await act(async () => {})
    
    // В режиме route не должно быть автоматического зума
    // fitBounds не должен вызываться при изменении routePoints
    expect(mockFitBounds).not.toHaveBeenCalled()
    
    // setView должен вызываться только при первой инициализации, не при изменении routePoints
    // Проверяем, что setView вызывался только для начальной позиции
    const setViewCalls = mockSetView.mock.calls.filter((call: any[]) => {
      // Игнорируем вызовы для начальной позиции (координаты пользователя или дефолтные)
      const [lat, lng] = call[0] || []
      return !(lat === 53.9 && lng === 27.5667)
    })
    expect(setViewCalls.length).toBe(0)
  })

  it('does not zoom when route points are added in route mode', async () => {
    const { useMap } = require('react-leaflet')
    const mockFitBounds = jest.fn()
    useMap.mockReturnValue({
      fitBounds: mockFitBounds,
      setView: jest.fn(),
      closePopup: jest.fn(),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      getZoom: jest.fn(() => 11),
      on: jest.fn(),
      off: jest.fn(),
    })
    
    const props = {
      ...defaultProps,
      mode: 'route' as const,
      routePoints: [] as [number, number][],
    }
    
    const { rerender } = render(<MapPageComponent {...props} />)
    await act(async () => {})
    
    // Добавляем старт
    rerender(<MapPageComponent {...props} routePoints={[[27.5667, 53.9]] as [number, number][]} />)
    await act(async () => {})
    expect(mockFitBounds).not.toHaveBeenCalled()
    
    // Добавляем финиш
    rerender(<MapPageComponent {...props} routePoints={[[27.5667, 53.9], [27.5767, 53.91]] as [number, number][]} />)
    await act(async () => {})
    expect(mockFitBounds).not.toHaveBeenCalled()
  })

  it('start and finish markers have click handlers that prevent zoom', async () => {
    const props = {
      ...defaultProps,
      mode: 'route' as const,
      routePoints: [[27.5667, 53.9], [27.5767, 53.91]] as [number, number][],
    }
    
    const { useMap } = require('react-leaflet')
    useMap.mockReturnValue({
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      getZoom: jest.fn(() => 11),
      on: jest.fn(),
      off: jest.fn(),
    })
    
    render(<MapPageComponent {...props} />)
    await act(async () => {})
    
    // Проверяем, что обработчики событий установлены для маркеров
    // Они должны предотвращать зум при клике
    const clickHandler = (globalThis as any).lastMarkerClickHandler
    expect(clickHandler).toBeDefined()
    
    // Симулируем клик на маркер
    const mockEvent = {
      originalEvent: {
        stopPropagation: jest.fn(),
      },
    }
    
    if (clickHandler) {
      clickHandler(mockEvent)
      expect(mockEvent.originalEvent.stopPropagation).toHaveBeenCalled()
    }
  })

  it('generates correct icon URLs for all icon types', () => {
    const fs = require('fs')
    const path = require('path')
    const filePath = path.join(__dirname, '../../components/MapPage/Map.web.tsx')
    
    if (!fs.existsSync(filePath)) {
      return
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8')
    
    // Check that all required icons use public URL paths
    const requiredIcons = ['marker.ico', 'user_location.ico', 'start.ico', 'end.ico']
    requiredIcons.forEach(icon => {
      expect(fileContent).toContain(`/assets/icons/${icon}`)
    })
  })

  it('uses public URL paths for web platform', () => {
    const fs = require('fs')
    const path = require('path')
    const filePath = path.join(__dirname, '../../components/MapPage/Map.web.tsx')
    
    if (!fs.existsSync(filePath)) {
      return
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8')
    
    // Check that public URL paths are used instead of require()
    expect(fileContent).toContain('/assets/icons/')
    
    // Should not use require() with template literals for icon assets
    // The old problematic pattern: require(`@/assets/icons/${iconName}`)
    const problematicPattern = /require\s*\(\s*[`'"]@\/assets\/icons\/\$\{/
    expect(fileContent).not.toMatch(problematicPattern)
    
    // Should not use require() for .ico files (use public paths instead)
    const requireIcoPattern = /require\s*\(\s*[`'"]@\/assets\/icons\/.*\.ico[`'"]/
    expect(fileContent).not.toMatch(requireIcoPattern)
  })

  describe('Route mode zoom prevention', () => {
    it('does not zoom when switching from radius to route mode', async () => {
      const { useMap } = require('react-leaflet')
      const mockFitBounds = jest.fn()
      const mockSetView = jest.fn()
      useMap.mockReturnValue({
        fitBounds: mockFitBounds,
        setView: mockSetView,
        closePopup: jest.fn(),
        getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
        getZoom: jest.fn(() => 11),
        on: jest.fn(),
        off: jest.fn(),
      })
      
      // Начинаем в режиме radius
      const props = {
        ...defaultProps,
        mode: 'radius' as const,
        routePoints: [] as [number, number][],
      }
      
      const { rerender } = render(<MapPageComponent {...props} />)
      await act(async () => {})
      
      // Очищаем моки перед переключением
      mockFitBounds.mockClear()
      mockSetView.mockClear()
      
      // Переключаемся на route mode
      rerender(<MapPageComponent {...props} mode="route" />)
      await act(async () => {})
      
      // В режиме route не должно быть автоматического зума
      expect(mockFitBounds).not.toHaveBeenCalled()
    })

    it('does not center on user location when in route mode', async () => {
      const { useMap } = require('react-leaflet')
      const mockSetView = jest.fn()
      useMap.mockReturnValue({
        fitBounds: jest.fn(),
        setView: mockSetView,
        closePopup: jest.fn(),
        getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
        getZoom: jest.fn(() => 11),
        on: jest.fn(),
        off: jest.fn(),
      })
      
      const props = {
        ...defaultProps,
        mode: 'route' as const,
        routePoints: [] as [number, number][],
      }
      
      render(<MapPageComponent {...props} />)
      await act(async () => {})
      
      // Проверяем, что setView вызывался только для coordinates, а не для userLocation
      const setViewCalls = mockSetView.mock.calls
      // В режиме route должен быть только один вызов setView для инициализации с coordinates
      expect(setViewCalls.length).toBeLessThanOrEqual(1)
      
      if (setViewCalls.length > 0) {
        const [center, zoom] = setViewCalls[0]
        // Должен использовать coordinates, а не userLocation
        expect(center).toEqual([53.9, 27.5667]) // coordinates из defaultProps
      }
    })

    it('preserves map position when route points are added', async () => {
      const { useMap } = require('react-leaflet')
      const mockSetView = jest.fn()
      const mockGetCenter = jest.fn(() => ({ lat: 50.5, lng: 19.0 }))
      const mockGetZoom = jest.fn(() => 12)
      
      useMap.mockReturnValue({
        fitBounds: jest.fn(),
        setView: mockSetView,
        closePopup: jest.fn(),
        getCenter: mockGetCenter,
        getZoom: mockGetZoom,
        on: jest.fn(),
        off: jest.fn(),
      })
      
      const props = {
        ...defaultProps,
        mode: 'route' as const,
        routePoints: [] as [number, number][],
      }
      
      const { rerender } = render(<MapPageComponent {...props} />)
      await act(async () => {})
      
      // Сохраняем текущую позицию
      const initialCenter = mockGetCenter()
      const initialZoom = mockGetZoom()
      
      // Очищаем моки
      mockSetView.mockClear()
      
      // Добавляем старт
      rerender(<MapPageComponent {...props} routePoints={[[19.0, 50.5]] as [number, number][]} />)
      await act(async () => {})
      
      // Карта не должна менять позицию
      // setView не должен вызываться после инициализации в режиме route
      const setViewCallsAfterStart = mockSetView.mock.calls
      expect(setViewCallsAfterStart.length).toBe(0)
    })

    it('does not zoom when tab is switched (simulated by remounting)', async () => {
      const { useMap } = require('react-leaflet')
      const mockFitBounds = jest.fn()
      const mockSetView = jest.fn()
      
      useMap.mockReturnValue({
        fitBounds: mockFitBounds,
        setView: mockSetView,
        closePopup: jest.fn(),
        getCenter: jest.fn(() => ({ lat: 50.5, lng: 19.0 })),
        getZoom: jest.fn(() => 12),
        on: jest.fn(),
        off: jest.fn(),
      })
      
      const props = {
        ...defaultProps,
        mode: 'route' as const,
        routePoints: [[19.0, 50.5]] as [number, number][],
      }
      
      // Первый рендер (симуляция открытия вкладки)
      const { unmount } = render(<MapPageComponent {...props} />)
      await act(async () => {})
      
      // Очищаем моки
      mockFitBounds.mockClear()
      mockSetView.mockClear()
      
      // Размонтируем (симуляция переключения вкладки)
      unmount()
      
      // Снова монтируем (симуляция возврата на вкладку)
      render(<MapPageComponent {...props} />)
      await act(async () => {})
      
      // В режиме route не должно быть автоматического зума при возврате на вкладку
      // setView может быть вызван только для инициализации, но не для центрирования на userLocation
      const setViewCalls = mockSetView.mock.calls
      expect(mockFitBounds).not.toHaveBeenCalled()
      
      // Если setView был вызван, он должен использовать coordinates, а не userLocation
      if (setViewCalls.length > 0) {
        const [center] = setViewCalls[0]
        expect(center).toEqual([53.9, 27.5667]) // coordinates, не userLocation
      }
    })
  })

  describe('React Hooks rules compliance', () => {
    it('declares all useRef hooks before conditional returns', () => {
      const fs = require('fs')
      const path = require('path')
      const filePath = path.join(__dirname, '../../components/MapPage/Map.web.tsx')
      
      if (!fs.existsSync(filePath)) {
        return
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8')
      
      // Находим все useRef объявления
      const useRefMatches = [...fileContent.matchAll(/const\s+\w+Ref\s*=\s*useRef/g)]
      
      // Находим условные возвраты (return statements before MapContainer)
      const conditionalReturns = fileContent.match(/if\s*\([^)]+\)\s*return\s+<[^>]+>/g) || []
      
      if (conditionalReturns.length > 0) {
        // Находим позицию первого условного возврата
        const firstReturnIndex = fileContent.indexOf(conditionalReturns[0])
        
        // Проверяем, что все useRef объявлены до первого условного возврата
        useRefMatches.forEach(match => {
          const refIndex = match.index || 0
          expect(refIndex).toBeLessThan(firstReturnIndex)
        })
      }
    })

    it('has useRef hooks in correct order', () => {
      const fs = require('fs')
      const path = require('path')
      const filePath = path.join(__dirname, '../../components/MapPage/Map.web.tsx')
      
      if (!fs.existsSync(filePath)) {
        return
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8')
      
      // Проверяем наличие всех необходимых useRef хуков
      expect(fileContent).toContain('const mapRef = useRef')
      expect(fileContent).toContain('const hasInitializedRef = useRef')
      expect(fileContent).toContain('const lastModeRef = useRef')
      expect(fileContent).toContain('const savedMapViewRef = useRef')
      
      // Проверяем, что они объявлены до условных возвратов
      const returnLoaderIndex = fileContent.indexOf('return <Loader')
      const mapRefIndex = fileContent.indexOf('const mapRef = useRef')
      const hasInitializedRefIndex = fileContent.indexOf('const hasInitializedRef = useRef')
      
      expect(mapRefIndex).toBeLessThan(returnLoaderIndex)
      expect(hasInitializedRefIndex).toBeLessThan(returnLoaderIndex)
    })
  })

  describe('Route mode initialization', () => {
    it('only initializes once in route mode and does not re-center', async () => {
      const { useMap } = require('react-leaflet')
      const mockSetView = jest.fn()
      const callOrder: string[] = []
      
      useMap.mockReturnValue({
        fitBounds: jest.fn(),
        setView: (...args: any[]) => {
          callOrder.push('setView')
          mockSetView(...args)
        },
        closePopup: jest.fn(),
        getCenter: jest.fn(() => ({ lat: 50.5, lng: 19.0 })),
        getZoom: jest.fn(() => 12),
        on: jest.fn(),
        off: jest.fn(),
      })
      
      const props = {
        ...defaultProps,
        mode: 'route' as const,
        routePoints: [] as [number, number][],
      }
      
      const { rerender } = render(<MapPageComponent {...props} />)
      await act(async () => {})
      
      const initialSetViewCalls = mockSetView.mock.calls.length
      
      // Симулируем несколько обновлений (как при переключении вкладок)
      for (let i = 0; i < 3; i++) {
        mockSetView.mockClear()
        rerender(<MapPageComponent {...props} />)
        await act(async () => {})
        
        // После первой инициализации setView не должен вызываться
        expect(mockSetView.mock.calls.length).toBe(0)
      }
    })
  })

  describe('Radius mode and markers rendering', () => {
    it('renders search radius circle with default radius when radius prop is not provided', async () => {
      const { Platform } = require('react-native')
      ;(Platform as any).OS = 'web'

      const props = {
        ...defaultProps,
        mode: 'radius' as const,
        // radius не передаем, должен использоваться дефолт 60км -> 60000м
      }

      const { getByTestId } = render(<MapPageComponent {...props} />)
      await act(async () => {})

      // Проверяем радиус через пропсы, сохранённые в моке Circle
      const circleProps = (globalThis as any).lastCircleProps
      expect(circleProps).toBeDefined()
      expect(circleProps.radius).toBe(60000)
    })

    it('uses provided radius prop (in km) and converts it to meters', async () => {
      const { Platform } = require('react-native')
      ;(Platform as any).OS = 'web'

      const props = {
        ...defaultProps,
        mode: 'radius' as const,
        radius: '10',
      }

      const { getByTestId } = render(<MapPageComponent {...props} />)
      await act(async () => {})

      const circleProps = (globalThis as any).lastCircleProps
      expect(circleProps).toBeDefined()
      expect(circleProps.radius).toBe(10000)
    })

    it('renders travel markers when travel data is provided (does not crash)', async () => {
      const travel = {
        data: [
          {
            id: 1,
            coord: '53.9,27.5667',
            address: 'Test Address',
            travelImageThumbUrl: 'thumb.jpg',
            categoryName: 'Test',
          },
        ],
      }

      const { queryAllByTestId } = render(
        <MapPageComponent
          {...defaultProps}
          mode="radius"
          travel={travel as any}
        />
      )

      await act(async () => {})

      // В тестовой среде достаточно убедиться, что запрос не приводит к ошибке
      const markers = queryAllByTestId('marker')
      expect(Array.isArray(markers)).toBe(true)
    })

    it('shows "no points" message in route mode when routePoints >= 2 and no travel data', async () => {
      const { Platform } = require('react-native')
      ;(Platform as any).OS = 'web'

      const props = {
        ...defaultProps,
        mode: 'route' as const,
        routePoints: [[27.5667, 53.9], [27.5767, 53.91]] as [number, number][],
        travel: { data: [] } as any,
      }

      const { getByTestId } = render(<MapPageComponent {...props} />)
      await act(async () => {})

      const message = getByTestId('no-points-message')
      expect(message).toBeTruthy()
    })
  })

  describe('My location button and location permissions', () => {
    it('renders "Мое местоположение" button and centers map on user location when clicked', async () => {
      const { useMap } = require('react-leaflet')
      const mockSetView = jest.fn()

      // Переопределяем мок useMap для отслеживания setView
      useMap.mockReturnValue({
        fitBounds: jest.fn(),
        setView: mockSetView,
        closePopup: jest.fn(),
        getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
        getZoom: jest.fn(() => 11),
        on: jest.fn(),
        off: jest.fn(),
      })

      const { Platform } = require('react-native')
      ;(Platform as any).OS = 'web'

      const props = {
        ...defaultProps,
        mode: 'radius' as const,
      }

      const { getByLabelText } = render(<MapPageComponent {...props} />)

      // Ждём, пока будет получена геолокация и появится кнопка (aria-label на кнопке)
      const myLocationButton = await waitFor(() => getByLabelText('Вернуться к моему местоположению'))
      expect(myLocationButton).toBeTruthy()

      // Кликаем по кнопке и проверяем, что setView был вызван
      fireEvent(myLocationButton as any, 'click' as any)
      expect(mockSetView).toHaveBeenCalled()
    })

    it('handles denied location permission without crashing', async () => {
      const ExpoLocation = require('expo-location')

      // Следующий вызов запроса прав вернёт статус denied
      ;(ExpoLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      })

      const props = {
        ...defaultProps,
        mode: 'radius' as const,
      }

      const result = render(<MapPageComponent {...props} />)
      await act(async () => {})

      // Достаточно того, что компонент отрендерился без ошибок
      expect(result).toBeTruthy()
    })
  })
})
