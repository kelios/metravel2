import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Platform } from 'react-native';
import WebMapComponent from '@/components/travel/WebMapComponent';

// #992 — wizard-карта теперь на общем MapCanvas, у которого web-гейт по
// Platform.OS; RN-preset в jest дефолтит 'ios' — эмулируем web-окружение
// (компонент web-only), как в mapCanvasEngine.test.tsx.
const originalPlatformOS = Platform.OS;
beforeAll(() => {
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalPlatformOS;
});

jest.mock('@/utils/pendingImageFiles', () => ({
  registerPendingImageFile: jest.fn(),
  removePendingImageFile: jest.fn(),
  getPendingImageFile: jest.fn(),
}));

import { getPendingImageFile, removePendingImageFile } from '@/utils/pendingImageFiles';

jest.mock('@/utils/exifGps', () => ({
  extractGpsFromImageFile: jest.fn(async () => ({ lat: 10, lng: 20 })),
}));

jest.mock('@/utils/webImageUpload', () => ({
  prepareWebImageFileForUpload: jest.fn(async (file: any) => file),
}));

import { extractGpsFromImageFile } from '@/utils/exifGps';
import { fireEvent } from '@testing-library/react';

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

jest.mock('@/components/travel/PhotoUploadWithPreview', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: ({ onUpload }: any) => React.createElement(
      'button',
      {
        type: 'button',
        'aria-label': 'Загрузить новое фото точки',
        onClick: () => onUpload('https://example.com/edited-point.webp'),
      },
      'Загрузить новое фото точки',
    ),
  };
});

// Category selection has dedicated component coverage. This suite exercises
// marker synchronization and edit persistence, so keep RN field primitives out
// of its DOM-only renderer (the selected category remains in modal state).
jest.mock('@/components/forms/MultiSelectField', () => ({
  __esModule: true,
  default: () => null,
}));

// Popup behavior has dedicated coverage. Keeping it out of this marker-sync
// suite avoids rendering React Native popup primitives through a DOM-only
// react-leaflet stub, which produces irrelevant unknown-prop warnings.
jest.mock('@/components/travel/WebMapMarkerPopup', () => () => null);

let lastMapEvents: any = null;

jest.mock('react-leaflet', () => {
  const React = require('react');
  const DummyContainer = ({ children }: any) => <div data-testid="map">{children}</div>;
  const Dummy = ({ children }: any) => <div>{children}</div>;
  const stableMap = {
    fitBounds: jest.fn(),
    setView: jest.fn(),
    closePopup: jest.fn(),
    getZoom: jest.fn(() => 13),
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
  };
  (globalThis as any).__webMapTestMap = stableMap;
  return {
    MapContainer: DummyContainer,
    TileLayer: Dummy,
    Marker: Dummy,
    Popup: Dummy,
    // Стабильный инстанс, как в реальном react-leaflet (один map на контейнер):
    // новый объект на каждый вызов зацикливал onMapRef→setMapCreatedNonce→рендер.
    useMap: jest.fn(() => stableMap),
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
    countrylist: [{ country_id: 268, title_ru: 'Грузия', code: 'GE' }],
    markers: [],
    onMarkersChange: jest.fn(),
    onCountrySelect: jest.fn(),
    onCountryDeselect: jest.fn(),
    travelId: '123',
  };

  beforeEach(() => {
    lastMapEvents = null;
    jest.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1200,
    });
    (getPendingImageFile as jest.Mock).mockReturnValue(new Blob(['point'], { type: 'image/webp' }));

    // Mock reverse geocode network calls.
    const mockFetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        city: 'Тбилиси',
        address: {
          city: 'Тбилиси',
          country: 'Грузия',
          country_code: 'ge',
          road: 'Rustaveli Avenue',
        },
      }),
    }));
    (global as any).fetch = mockFetch;

  });

  it('renders the narrow marker list as an inline panel instead of a clipped map overlay', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 800,
    });

    render(
      <WebMapComponent
        {...baseProps}
        markers={[
          {
            id: 1,
            lat: 10,
            lng: 20,
            address: 'Тбилиси, Грузия',
            categories: [1],
            image: '',
            country: 268,
          },
        ] as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Показать точки (1)' }));

    await waitFor(() => {
      expect(screen.getAllByText('Тбилиси, Грузия').length).toBeGreaterThan(0);
    });

    const listRoot = document.getElementById('markers-list-panel') as HTMLElement | null;
    expect(listRoot).not.toBeNull();
    expect(listRoot?.style.position).toBe('');
    expect(listRoot?.style.maxHeight).toBe('');
    expect(listRoot?.style.overflow).toBe('hidden');
  });

  it('exposes working locate and zoom controls on the wizard map', async () => {
    const getCurrentPosition = jest.fn((onSuccess: PositionCallback) => {
      onSuccess({
        coords: { latitude: 52.2297, longitude: 21.0122 },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<WebMapComponent {...baseProps} />);

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Приблизить карту' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отдалить карту' }));
    fireEvent.click(screen.getByRole('button', { name: 'Определить моё местоположение' }));

    const map = (globalThis as any).__webMapTestMap;
    expect(map.zoomIn).toHaveBeenCalledTimes(1);
    expect(map.zoomOut).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
    expect(map.setView).toHaveBeenCalledWith([52.2297, 21.0122], 15, { animate: true });
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

  it('edits an existing point with a new photo and persists it once without a parent-rerender commit loop', async () => {
    const initialMarkers = [
      {
        id: 42,
        lat: 41.7151,
        lng: 44.8271,
        address: 'Старый адрес',
        categories: [1],
        image: 'https://example.com/old-point.webp',
        country: 268,
      },
    ];
    const onMarkersChange = jest.fn();
    const onMarkerEditSave = jest.fn();

    function StatefulRoutePointEditor() {
      const [markers, setMarkers] = React.useState(initialMarkers);
      const handleMarkersChange = React.useCallback((updatedMarkers: any[]) => {
        onMarkersChange(updatedMarkers);
        setMarkers(updatedMarkers);
      }, []);
      const handleMarkerEditSave = React.useCallback(async (updatedMarkers: any[]) => {
        onMarkerEditSave(updatedMarkers);
        // Имитируем обычный server echo после upsert: новый массив/объект с теми
        // же сохранёнными данными возвращается родителю и снова приходит в карту.
        setMarkers(updatedMarkers.map((marker) => ({ ...marker })));
      }, []);

      return (
        <WebMapComponent
          {...baseProps}
          markers={markers as any}
          onMarkersChange={handleMarkersChange}
          onMarkerEditSave={handleMarkerEditSave}
        />
      );
    }

    render(<StatefulRoutePointEditor />);

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
    fireEvent.change(screen.getByDisplayValue('Старый адрес'), {
      target: { value: 'Новый адрес точки' },
    });
    expect(screen.getByDisplayValue('Новый адрес точки')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Загрузить новое фото точки' }));
    // Parent получил новый URL фото и перерендерил карту. Локальный черновик
    // остальных полей редактора при этом не должен откатываться к marker prop.
    expect(screen.getByDisplayValue('Новый адрес точки')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(onMarkerEditSave).toHaveBeenCalledTimes(1);
    });

    expect(onMarkerEditSave).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 42,
        address: 'Новый адрес точки',
        categories: [1],
        image: 'https://example.com/edited-point.webp',
      }),
    ]);

    // Фото коммитится в parent сразу для preview, итоговые поля — при Save.
    // Server echo не должен запускать третий commit или повторный persist.
    expect(onMarkersChange).toHaveBeenCalledTimes(2);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onMarkersChange).toHaveBeenCalledTimes(2);
    expect(onMarkerEditSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Новый адрес точки')).toBeTruthy();
  });

  it('preserves the open editor draft when a parent echo assigns the point id', async () => {
    const initialMarkers = [
      {
        id: null,
        lat: 41.7151,
        lng: 44.8271,
        address: 'Черновой адрес',
        categories: [1],
        image: null,
        country: 268,
      },
    ];
    const serverMarkers = [
      {
        ...initialMarkers[0],
        id: 55,
      },
    ];

    const utils = render(
      <WebMapComponent
        {...baseProps}
        markers={initialMarkers as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
    fireEvent.change(screen.getByDisplayValue('Черновой адрес'), {
      target: { value: 'Несохранённый адрес автора' },
    });

    utils.rerender(
      <WebMapComponent
        {...baseProps}
        markers={serverMarkers as any}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Несохранённый адрес автора')).toBeTruthy();
    });
  });

  it('preserves local blob preview when backend assigns id (merge fallback by lat/lng)', async () => {
    const blob = 'blob:https://example.com/preview';

    const initialMarkers = [
      { id: null, lat: 10, lng: 20, address: 'A', categories: [], image: blob, country: null },
    ];
    const serverMarkers = [
      // Backend assigns id; image may be null on first response.
      { id: 55, lat: '10', lng: '20', address: 'A', categories: [], image: null, country: null },
    ];

    const utils = render(
      <WebMapComponent
        {...baseProps}
        markers={initialMarkers as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    const initialImg = screen.getAllByRole('img', { name: /Фото/i })[0] as HTMLImageElement;
    expect(initialImg.src).toContain(blob);

    utils.rerender(
      <WebMapComponent
        {...baseProps}
        markers={serverMarkers as any}
      />,
    );

    const updatedImg = screen.getAllByRole('img', { name: /Фото/i })[0] as HTMLImageElement;
    expect(updatedImg.src).toContain(blob);
  });

  it('preserves local blob preview when backend echoes fallback server image before point upload', async () => {
    const blob = 'blob:https://example.com/preview';

    const initialMarkers = [
      { id: null, lat: 10, lng: 20, address: 'A', categories: [], image: blob, country: null },
    ];
    const serverMarkers = [
      { id: 55, lat: '10', lng: '20', address: 'A', categories: [], image: 'https://example.com/travel-cover.webp', country: null },
    ];

    const utils = render(
      <WebMapComponent
        {...baseProps}
        markers={initialMarkers as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    utils.rerender(
      <WebMapComponent
        {...baseProps}
        markers={serverMarkers as any}
      />,
    );

    const updatedImg = screen.getAllByRole('img', { name: /Фото/i })[0] as HTMLImageElement;
    expect(updatedImg.src).toContain(blob);
    expect(getPendingImageFile).toHaveBeenCalledWith(blob);
  });

  it('adds marker on map click and propagates it via onMarkersChange (regression: point must be saved)', async () => {
    const onMarkersChange = jest.fn();
    const onCountrySelect = jest.fn();
    const onMarkerAdded = jest.fn();

    render(
      <WebMapComponent
        {...baseProps}
        markers={[] as any}
        onMarkersChange={onMarkersChange}
        onCountrySelect={onCountrySelect}
        onMarkerAdded={onMarkerAdded}
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
          country: 268,
          // #1717: подпись точки — короткое имя объекта, а не цепочка
          // геокодера. У этого ответа объекта нет, но есть улица, поэтому
          // именем становится она, а «Тбилиси · Грузия» в название не уезжает.
          address: 'Rustaveli Avenue',
        }),
      );
    });

    expect(onCountrySelect).toHaveBeenCalledWith('268');

    // Точка без категории/фото должна сразу триггерить сохранение (тикет #505),
    // не дожидаясь 5-сек автосейва.
    await waitFor(() => {
      expect(onMarkerAdded).toHaveBeenCalledTimes(1);
    });
    const addedPayload = onMarkerAdded.mock.calls[0][0];
    expect(addedPayload.markers.length).toBe(1);
    expect(addedPayload.markers[0]).toEqual(
      expect.objectContaining({ lat: 10, lng: 20, id: null }),
    );
    expect(addedPayload.derivedCountryId).toBe(268);
  });

  it('does not fire onMarkerAdded for the photo path (no duplicate save; onPhotoMarkerReady owns it)', async () => {
    (global as any).URL.createObjectURL = jest.fn(() => 'blob:https://example.com/photo');
    (global as any).URL.revokeObjectURL = jest.fn();
    (extractGpsFromImageFile as jest.Mock).mockResolvedValue({ lat: 10, lng: 20 });

    const onMarkerAdded = jest.fn();
    const onPhotoMarkerReady = jest.fn(async () => {});

    const { container } = render(
      <WebMapComponent
        {...baseProps}
        markers={[] as any}
        onMarkerAdded={onMarkerAdded}
        onPhotoMarkerReady={onPhotoMarkerReady}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    });

    await waitFor(() => {
      expect(onPhotoMarkerReady).toHaveBeenCalled();
    });

    expect(onMarkerAdded).not.toHaveBeenCalled();
  });

  it('keeps preview blob and pending file when route autosave fails after adding point from photo (regression)', async () => {
    const previewBlob = 'blob:https://example.com/photo-preview';
    const createObjectURL = jest.fn(() => previewBlob);
    const revokeObjectURL = jest.fn();
    (global as any).URL.createObjectURL = createObjectURL;
    (global as any).URL.revokeObjectURL = revokeObjectURL;
    (extractGpsFromImageFile as jest.Mock).mockResolvedValue({ lat: 10, lng: 20 });

    // Сейв маршрута падает: у новой точки нет categories (модерационная валидация).
    const onPhotoMarkerReady = jest.fn(async () => {
      throw new Error('Заполните обязательные поля для модерации: categories');
    });

    const { container } = render(
      <WebMapComponent
        {...baseProps}
        markers={[] as any}
        onPhotoMarkerReady={onPhotoMarkerReady}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Загрузка карты…')).toBeNull();
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const fakeFile = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    });

    await waitFor(() => {
      expect(onPhotoMarkerReady).toHaveBeenCalled();
    });

    // Preview-blob жив: НЕ ревокнут и pending-файл НЕ удалён в error-ветке —
    // иначе миниатюра серая (мёртвый objectURL).
    expect(revokeObjectURL).not.toHaveBeenCalledWith(previewBlob);
    expect(removePendingImageFile).not.toHaveBeenCalledWith(previewBlob);
  });
});
