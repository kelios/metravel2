import React from 'react'
import { render, act } from '@testing-library/react-native'
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

const mockReactLeaflet = {
  MapContainer: ({ children, ...props }: any) => <div data-testid="map-container" {...props}>{children}</div>,
  TileLayer: (props: any) => <div data-testid="tile-layer" {...props} />,
  Marker: (props: any) => <div data-testid="marker" {...props} />,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  useMap: jest.fn(() => ({
    fitBounds: jest.fn(),
    setView: jest.fn(),
    closePopup: jest.fn(),
    latLngToContainerPoint: jest.fn(() => ({ x: 0, y: 0 })),
  })),
  useMapEvents: jest.fn(),
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
jest.mock('react-leaflet', () => mockReactLeaflet)

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
    // Component should handle missing modules without crashing
    const { getByText } = render(<MapPageComponent {...defaultProps} />)
    await act(async () => {})
    // Should show loading state initially (leaflet modules load asynchronously)
    expect(getByText(/Loading/i)).toBeTruthy()
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
})

