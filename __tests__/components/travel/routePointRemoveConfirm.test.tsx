import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import MarkersListComponent from '@/components/map/MarkersListComponent';
import WebMapMarkerPopup from '@/components/travel/WebMapMarkerPopup';

// #3214: on the site the point list and the marker popup removed a route point on
// the first click; the next autosave then deleted it on the server with its photo.
// The components run for real; only the question's answer is scripted.
jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(),
}));

jest.mock('@/components/forms/MultiSelectField', () => () => null);
jest.mock('@/components/travel/PhotoUploadWithPreview', () => () => null);

jest.mock('@/components/MapPage/Map/PlacePopupCard', () => ({
  __esModule: true,
  default: ({ extraActions }: { extraActions: Array<{ key: string; label: string; onPress: () => void }> }) => (
    <div>
      {extraActions.map((action) => (
        <button key={action.key} type="button" data-testid={`popup-${action.key}`} onClick={action.onPress}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

const { confirmAction } = jest.requireMock('@/utils/confirmAction') as { confirmAction: jest.Mock };

const marker = { id: 5, lat: 53.9, lng: 27.56, country: null, address: 'Минск, Немига', image: '', categories: [] };

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

const renderList = (handleMarkerRemove: jest.Mock) => render(
  <MarkersListComponent
    markers={[marker as any]}
    categoryTravelAddress={[]}
    handleMarkerChange={jest.fn()}
    handleImageUpload={jest.fn()}
    handleMarkerRemove={handleMarkerRemove}
    editingIndex={null}
    setEditingIndex={jest.fn()}
  />,
);

const renderPopup = (onRemove: jest.Mock) => render(
  <WebMapMarkerPopup
    marker={marker}
    markerIndex={0}
    categoryTravelAddress={[]}
    colors={{} as any}
    onEdit={jest.fn()}
    onRemove={onRemove}
    onClose={jest.fn()}
  />,
);

describe('route point removal asks first (#3214)', () => {
  beforeEach(() => {
    confirmAction.mockReset();
  });

  it('list row: cancel keeps the point', async () => {
    confirmAction.mockResolvedValue(false);
    const remove = jest.fn();
    renderList(remove);

    fireEvent.click(screen.getAllByLabelText('Удалить')[0]);
    await flush();

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Минск, Немига'),
    }));
    expect(remove).not.toHaveBeenCalled();
  });

  it('list row: confirm removes the point', async () => {
    confirmAction.mockResolvedValue(true);
    const remove = jest.fn();
    renderList(remove);

    fireEvent.click(screen.getAllByLabelText('Удалить')[0]);
    await flush();

    expect(remove).toHaveBeenCalledWith(0);
  });

  it('map popup: cancel keeps the point, confirm removes it', async () => {
    const remove = jest.fn();
    confirmAction.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderPopup(remove);

    fireEvent.click(screen.getByTestId('popup-delete'));
    await flush();
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('popup-delete'));
    await flush();
    expect(remove).toHaveBeenCalledWith(0);
  });
});
