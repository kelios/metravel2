import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import MarkersListComponent from '@/components/map/MarkersListComponent';

jest.mock('@/components/MultiSelectField', () => {
    return jest.fn((props: any) => (
        <div data-testid="marker-categories-value">{JSON.stringify(props.value)}</div>
    ));
});

jest.mock('@/components/travel/PhotoUploadWithPreview', () => {
    return jest.fn((props: any) => (
        <div>
            <div data-testid="photo-upload-mock" />
            <button
                type="button"
                data-testid="photo-upload-trigger"
                onClick={() => props?.onUpload?.('http://192.168.50.36/travel-image/17992/conversions/test.webp')}
            >
                trigger-upload
            </button>
        </div>
    ));
});

const baseMarker = {
    id: 123,
    lat: 0,
    lng: 0,
    country: null,
    address: 'Test address',
    image: '',
    categories: [1, 2],
};

describe('MarkersListComponent - Edit modal categories', () => {
    it('preselects existing categories when opening edit modal', () => {
        render(
            <MarkersListComponent
                markers={[baseMarker]}
                categoryTravelAddress={[
                    { id: 1, name: 'Кафе' },
                    { id: 2, name: 'Парки' },
                    { id: 3, name: 'Музеи' },
                ]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={0}
                setEditingIndex={jest.fn()}
            />,
        );

        const valueNode = screen.getByTestId('marker-categories-value');
        expect(valueNode.textContent).toContain('"1"');
        expect(valueNode.textContent).toContain('"2"');
    });

    it('does not render photo upload when marker has no id (unsaved point)', () => {
        const markerWithoutId = {
            ...baseMarker,
            id: null,
        };

        render(
            <MarkersListComponent
                markers={[markerWithoutId as any]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={0}
                setEditingIndex={jest.fn()}
            />,
        );

        expect(screen.queryByTestId('photo-upload-mock')).toBeNull();
    });

    it('renders photo upload when marker has id (saved point)', () => {
        render(
            <MarkersListComponent
                markers={[baseMarker]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={0}
                setEditingIndex={jest.fn()}
            />,
        );

        expect(screen.queryByTestId('photo-upload-mock')).toBeTruthy();
    });

    it('persists uploaded image URL on modal save (regression: preview should show on reopen without reload)', async () => {
        const handleMarkerChange = jest.fn();

        render(
            <MarkersListComponent
                markers={[baseMarker]}
                categoryTravelAddress={[
                    { id: 1, name: 'Кафе' },
                    { id: 2, name: 'Парки' },
                ]}
                handleMarkerChange={handleMarkerChange}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={0}
                setEditingIndex={jest.fn()}
            />,
        );

        // Simulate upload inside modal.
        fireEvent.click(screen.getByTestId('photo-upload-trigger'));

        // Wait for React state update to flush (localImage should be updated).
        await waitFor(() => {
            expect(handleMarkerChange).not.toHaveBeenCalledWith(0, 'image', '');
        });

        // Save modal -> persistEdits should push image into marker state.
        fireEvent.click(screen.getByText('Сохранить'));

        await waitFor(() => {
            expect(handleMarkerChange).toHaveBeenCalledWith(
                0,
                'image',
                'http://192.168.50.36/travel-image/17992/conversions/test.webp',
            );
        });
    });
});
