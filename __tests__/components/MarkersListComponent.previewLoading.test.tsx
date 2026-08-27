import React from 'react';
import { render, screen } from '@testing-library/react';

import MarkersListComponent from '@/components/map/MarkersListComponent';

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: ({ loading, src }: { loading?: string; src?: string }) => (
    <div data-testid="point-preview-media" data-loading={loading} data-src={src} />
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
  ])('loads the newly selected local preview eagerly: %s', (image) => {
    renderMarker(image);

    expect(screen.getByTestId('point-preview-media').getAttribute('data-loading')).toBe('eager');
  });

  it('keeps persisted server point images lazy', () => {
    renderMarker('https://example.com/travel-address/point.webp');

    expect(screen.getByTestId('point-preview-media').getAttribute('data-loading')).toBe('lazy');
  });
});
