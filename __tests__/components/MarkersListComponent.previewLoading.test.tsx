import React from 'react';
import { render, screen } from '@testing-library/react';

import MarkersListComponent from '@/components/map/MarkersListComponent';

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: ({
    height,
    loading,
    recyclingKey,
    src,
    width,
  }: {
    height?: number | string;
    loading?: string;
    recyclingKey?: string;
    src?: string;
    width?: number | string;
  }) => (
    <div
      data-testid="point-preview-media"
      data-height={height}
      data-loading={loading}
      data-recycling-key={recyclingKey}
      data-src={src}
      data-width={width}
    />
  ),
}));

jest.mock('@/components/forms/MultiSelectField', () => ({
  __esModule: true,
  default: () => null,
}));

const renderMarker = (image: string) => render(
  <MarkersListComponent
    markers={[{
      id: 123,
      lat: 49.6274,
      lng: 21.1955,
      country: null,
      address: 'EXIF point',
      image,
      categories: [],
    }]}
    categoryTravelAddress={[]}
    handleMarkerChange={jest.fn()}
    handleImageUpload={jest.fn()}
    handleMarkerRemove={jest.fn()}
    editingIndex={null}
    setEditingIndex={jest.fn()}
  />,
);

describe('MarkersListComponent point preview loading', () => {
  it.each([
    'blob:http://localhost/route-point-preview',
    'data:image/png;base64,iVBORw0KGgo=',
    'https://example.com/travel-address/point.webp',
  ])('loads editor thumbnails eagerly so blob→server swap stays visible: %s', (image) => {
    renderMarker(image);

    const media = screen.getByTestId('point-preview-media');
    expect(media.getAttribute('data-loading')).toBe('eager');
    expect(media.getAttribute('data-recycling-key')).toBe(image);
    expect(media.getAttribute('data-src')).toBe(image);
    expect(media.getAttribute('data-width')).toBe('48');
    expect(media.getAttribute('data-height')).toBe('48');
  });

  it('remounts the thumbnail identity when the preview URL swaps to the uploaded file', () => {
    const { rerender } = renderMarker('blob:http://localhost/route-point-preview');
    const blobMedia = screen.getByTestId('point-preview-media');
    expect(blobMedia.getAttribute('data-recycling-key')).toBe(
      'blob:http://localhost/route-point-preview',
    );

    rerender(
      <MarkersListComponent
        markers={[{
          id: 123,
          lat: 49.6274,
          lng: 21.1955,
          country: null,
          address: 'EXIF point',
          image: 'https://example.com/travel-address/point.webp',
          categories: [],
        }]}
        categoryTravelAddress={[]}
        handleMarkerChange={jest.fn()}
        handleImageUpload={jest.fn()}
        handleMarkerRemove={jest.fn()}
        editingIndex={null}
        setEditingIndex={jest.fn()}
      />,
    );

    const uploadedMedia = screen.getByTestId('point-preview-media');
    expect(uploadedMedia.getAttribute('data-loading')).toBe('eager');
    expect(uploadedMedia.getAttribute('data-recycling-key')).toBe(
      'https://example.com/travel-address/point.webp',
    );
    expect(uploadedMedia.getAttribute('data-src')).toBe(
      'https://example.com/travel-address/point.webp',
    );
  });
});
