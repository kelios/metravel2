import { render, screen, waitFor, act } from '@testing-library/react';
import WebMapComponent from '@/components/travel/WebMapComponent';

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react');

  const Mock = ({ src, source, alt, style }: any) => {
    const resolvedSrc = src || source?.uri || '';
    return React.createElement('img', {
      src: resolvedSrc,
      alt: alt || 'Фото',
      style,
    });
  };

  return {
    __esModule: true,
    default: Mock,
  };
});

let lastMapEvents: any = null;

jest.mock('react-leaflet', () => {
  const React = require('react');
  const DummyContainer = ({ children }: any) => <div data-testid="map">{children}</div>;
  const Dummy = ({ children }: any) => <div>{children}</div>;
  return {
    MapContainer: DummyContainer,
    TileLayer: Dummy,
    Marker: Dummy,
    Popup: Dummy,
    useMap: jest.fn(() => ({
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 13),
    })),
    useMapEvents: jest.fn((handlers: any) => {
      lastMapEvents = handlers;
      return {};
    }),
  };
});

// Минимальный мок leaflet, чтобы пройти создание иконки/границ
beforeAll(() => {
  // JSDOM does not implement scrollTo on elements; WebMapComponent renders MarkersListComponent
  // which calls container.scrollTo when active marker changes.
  if (!(HTMLElement.prototype as any).scrollTo) {
    (HTMLElement.prototype as any).scrollTo = jest.fn();
  }

  (global as any).L = {
    Icon: class Icon {},
    latLngBounds: jest.fn(() => ({
      extend: jest.fn(),
      isValid: jest.fn(() => true),
    })),
  };
});

describe('WebMapComponent marker sync', () => {
  const baseProps = {
    categoryTravelAddress: [{ id: 1, name: 'Категория' }],
    countrylist: [],
    markers: [],
    onMarkersChange: jest.fn(),
    onCountrySelect: jest.fn(),
    onCountryDeselect: jest.fn(),
    travelId: '123',
  };

  beforeEach(() => {
    lastMapEvents = null;
    jest.clearAllMocks();

    // Mock reverse geocode network calls.
    const mockFetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ city: 'Test City' }),
    }));
    (global as any).fetch = mockFetch;
  });

  it('updates marker preview when marker props change without length change', async () => {
    const initialMarkers = [
      { id: 1, lat: 1, lng: 2, address: 'A', categories: [1], image: '/img1.jpg', country: null },
    ];
    const updatedMarkers = [
      { id: 1, lat: 1, lng: 2, address: 'A', categories: [1], image: '/img2.jpg', country: null },
    ];

    const utils = render(
      <WebMapComponent
        {...baseProps}
        markers={initialMarkers as any}
      />,
    );

    // Дождаться, когда карта перейдёт из состояния загрузки
    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    const initialImg = screen.getAllByRole('img', { name: /Фото/i })[0] as HTMLImageElement;
    expect(initialImg.src).toContain('/img1.jpg');

    // Ререндер с тем же количеством маркеров, но с другой картинкой
    utils.rerender(
      <WebMapComponent
        {...baseProps}
        markers={updatedMarkers as any}
      />,
    );

    const updatedImg = screen.getAllByRole('img', { name: /Фото/i })[0] as HTMLImageElement;
    expect(updatedImg.src).toContain('/img2.jpg');
  });

  it('adds marker on map click and propagates it via onMarkersChange (regression: point must be saved)', async () => {
    const onMarkersChange = jest.fn();

    render(
      <WebMapComponent
        {...baseProps}
        markers={[] as any}
        onMarkersChange={onMarkersChange}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    await waitFor(() => {
      expect(typeof lastMapEvents?.click).toBe('function');
    });

    await act(async () => {
      await lastMapEvents.click({ latlng: { lat: 10, lng: 20 } });
    });

    await waitFor(() => {
      expect(onMarkersChange).toHaveBeenCalled();
      const lastCall = onMarkersChange.mock.calls[onMarkersChange.mock.calls.length - 1][0];
      expect(Array.isArray(lastCall)).toBe(true);
      expect(lastCall.length).toBe(1);
      expect(lastCall[0]).toEqual(
        expect.objectContaining({
          lat: 10,
          lng: 20,
          id: null,
        }),
      );
    });
  });
});
