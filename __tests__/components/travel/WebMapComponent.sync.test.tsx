import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WebMapComponent from '@/components/travel/WebMapComponent';

jest.mock('react-leaflet', () => {
  const React = require('react');
  const DummyContainer = ({ children }: any) => <div data-testid="map">{children}</div>;
  const Dummy = ({ children }: any) => <div>{children}</div>;
  return {
    MapContainer: DummyContainer,
    TileLayer: Dummy,
    Marker: Dummy,
    Popup: Dummy,
    useMap: jest.fn(() => ({ fitBounds: jest.fn() })),
    useMapEvents: jest.fn(() => ({})),
  };
});

// Минимальный мок leaflet, чтобы пройти создание иконки/границ
beforeAll(() => {
  (global as any).L = {
    Icon: class Icon {},
    latLngBounds: jest.fn(() => ({
      extend: jest.fn(),
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
});
