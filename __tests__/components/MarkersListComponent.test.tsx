import React from 'react';
import { render, screen } from '@testing-library/react';

import MarkersListComponent from '@/components/MarkersListComponent';

jest.mock('@/components/MultiSelectField', () => {
    return jest.fn((props: any) => (
        <div data-testid="marker-categories-value">{JSON.stringify(props.value)}</div>
    ));
});

jest.mock('@/components/travel/PhotoUploadWithPreview', () => {
    return jest.fn(() => <div data-testid="photo-upload-mock" />);
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
});
