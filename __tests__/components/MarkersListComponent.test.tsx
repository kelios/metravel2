import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import MarkersListComponent from '@/components/map/MarkersListComponent';
import { EXIF_IMAGE_INPUT_ACCEPT } from '@/utils/exifGps';

jest.mock('@/components/forms/MultiSelectField', () => {
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

    it('does not show the photo badge for empty or serialized-empty image values', () => {
        render(
            <MarkersListComponent
                markers={[{ ...baseMarker, image: 'null' }]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={null}
                setEditingIndex={jest.fn()}
            />,
        );

        expect(screen.queryByText('Есть фото')).toBeNull();
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

    it('shows an empty search state and can reset the point filter', () => {
        render(
            <MarkersListComponent
                markers={[{ ...baseMarker, address: 'Минск, Беларусь' }]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={null}
                setEditingIndex={jest.fn()}
            />,
        );

        fireEvent.change(screen.getByPlaceholderText('Поиск по адресу'), {
            target: { value: 'Тбилиси' },
        });

        expect(screen.getByText('Ничего не найдено')).toBeTruthy();
        expect(screen.queryByText('Минск, Беларусь')).toBeNull();

        fireEvent.click(screen.getByText('Очистить поиск'));

        expect(screen.getByText('Минск, Беларусь')).toBeTruthy();
        expect(screen.queryByText('Ничего не найдено')).toBeNull();
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

    it('calls marker save callback when modal save is clicked', async () => {
        const handleMarkerSave = jest.fn().mockResolvedValue(undefined);

        render(
            <MarkersListComponent
                markers={[baseMarker]}
                categoryTravelAddress={[
                    { id: 1, name: 'Кафе' },
                    { id: 2, name: 'Парки' },
                ]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerSave={handleMarkerSave}
                handleMarkerRemove={jest.fn()}
                editingIndex={0}
                setEditingIndex={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByText('Сохранить'));

        await waitFor(() => {
            expect(handleMarkerSave).toHaveBeenCalledWith(
                0,
                expect.objectContaining({
                    address: 'Test address',
                    categories: ['1', '2'],
                    image: '',
                }),
            );
        });
    });

    const makeDragEvent = (type: string, files: File[]) => {
        const event = new Event(type, { bubbles: true, cancelable: true }) as any;
        event.dataTransfer = { files, types: ['Files'], dropEffect: 'none' };
        return event as DragEvent;
    };

    it('shows the drop overlay while dragging files over the panel', () => {
        const { container } = render(
            <MarkersListComponent
                markers={[]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={null}
                setEditingIndex={jest.fn()}
                onAddMarkerFromPhoto={jest.fn()}
            />,
        );

        const panel = container.firstElementChild as HTMLElement;
        expect(screen.queryByText(/Отпустите фото/i)).toBeNull();

        fireEvent(panel, makeDragEvent('dragenter', []));
        expect(screen.getByText(/Отпустите фото/i)).toBeTruthy();

        fireEvent(panel, makeDragEvent('dragleave', []));
        expect(screen.queryByText(/Отпустите фото/i)).toBeNull();
    });

    it('calls onAddMarkerFromPhoto for each dropped image file', async () => {
        const onAddMarkerFromPhoto = jest.fn().mockResolvedValue(undefined);
        const { container } = render(
            <MarkersListComponent
                markers={[]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={null}
                setEditingIndex={jest.fn()}
                onAddMarkerFromPhoto={onAddMarkerFromPhoto}
            />,
        );

        const panel = container.firstElementChild as HTMLElement;
        const img1 = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
        const img2 = new File([new Uint8Array([2])], 'b.heic', { type: '' });
        const notImage = new File([new Uint8Array([3])], 'notes.txt', { type: 'text/plain' });

        fireEvent(panel, makeDragEvent('drop', [img1, img2, notImage]));

        await waitFor(() => {
            expect(onAddMarkerFromPhoto).toHaveBeenCalledTimes(2);
        });
        // identity check by reference: jsdom File objects serialize identically, so
        // toHaveBeenCalledWith can't distinguish them — inspect the actual call args.
        const passedFiles = onAddMarkerFromPhoto.mock.calls.map((call) => call[0]);
        expect(passedFiles).toContain(img1);
        expect(passedFiles).toContain(img2);
        expect(passedFiles).not.toContain(notImage);
    });

    it('renders an explicit drop zone that opens the file picker on click (empty state)', () => {
        const { container } = render(
            <MarkersListComponent
                markers={[]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={null}
                setEditingIndex={jest.fn()}
                onAddMarkerFromPhoto={jest.fn()}
            />,
        );

        const dropZone = screen.getByText('Перетащите фото сюда');
        expect(dropZone).toBeTruthy();

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});
        fireEvent.click(dropZone);
        expect(clickSpy).toHaveBeenCalled();
    });

    it('does not render the drop zone when onAddMarkerFromPhoto is absent (empty state)', () => {
        render(
            <MarkersListComponent
                markers={[]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={null}
                setEditingIndex={jest.fn()}
            />,
        );

        expect(screen.queryByText('Перетащите фото сюда')).toBeNull();
    });

    it('does not wire drag-and-drop when onAddMarkerFromPhoto is absent', () => {
        const { container } = render(
            <MarkersListComponent
                markers={[]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={null}
                setEditingIndex={jest.fn()}
            />,
        );

        const panel = container.firstElementChild as HTMLElement;
        fireEvent(panel, makeDragEvent('dragenter', []));
        expect(screen.queryByText(/Отпустите фото/i)).toBeNull();
    });

    it('allows selecting HEIC and HEIF files for EXIF import on web', () => {
        const { container } = render(
            <MarkersListComponent
                markers={[baseMarker]}
                categoryTravelAddress={[{ id: 1, name: 'Кафе' }]}
                handleMarkerChange={jest.fn()}
                handleImageUpload={jest.fn()}
                handleMarkerRemove={jest.fn()}
                editingIndex={0}
                setEditingIndex={jest.fn()}
                onAddMarkerFromPhoto={jest.fn()}
            />,
        );

        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toBeTruthy();
        expect(fileInput?.getAttribute('accept')).toBe(EXIF_IMAGE_INPUT_ACCEPT);
        expect(fileInput?.getAttribute('accept')).toContain('.heic');
        expect(fileInput?.getAttribute('accept')).toContain('.heif');
    });
});
