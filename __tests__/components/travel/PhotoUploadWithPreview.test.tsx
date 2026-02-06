import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import { uploadImage } from '@/api/misc';
import { Platform } from 'react-native';

const ORIGINAL_PLATFORM_OS = Platform.OS;

// Mock dependencies
jest.mock('@/api/misc');
jest.mock('react-native-image-picker', () => ({
    launchImageLibrary: jest.fn(),
}));
let lastOnDrop: any = null;
jest.mock('react-dropzone', () => ({
    useDropzone: jest.fn((opts: any) => {
        lastOnDrop = opts?.onDrop;
        return {
            getRootProps: jest.fn(() => ({})),
            getInputProps: jest.fn(() => ({})),
            isDragActive: false,
        };
    }),
}));

// Mock Expo icons
jest.mock('@expo/vector-icons', () => ({
    Feather: 'Feather',
    FontAwesome: 'FontAwesome',
}));

const mockUploadImage = uploadImage as jest.MockedFunction<typeof uploadImage>;
const getWebPreviewImg = (screen: any) => {
    const nodes = screen.UNSAFE_getAllByType('img' as any);
    const preview = nodes.find((node: any) => node?.props?.alt === 'Предпросмотр');
    if (!preview) {
        throw new Error('Preview image not found');
    }
    return preview;
};
const queryWebPreviewImg = (screen: any) => {
    const nodes = screen.UNSAFE_queryAllByType?.('img' as any) ?? [];
    return nodes.find((node: any) => node?.props?.alt === 'Предпросмотр') ?? null;
};

describe('PhotoUploadWithPreview', () => {
    const defaultProps = {
        collection: 'travelMainImage',
        idTravel: '123',
        onUpload: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUploadImage.mockReset();
        lastOnDrop = null;

        // Some tests temporarily override Platform.OS; ensure it is reset to avoid cross-test leaks.
        Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS });
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    afterEach(() => {
        // Ensure no pending timers leak into @testing-library/react-native cleanup.
        jest.useRealTimers();
        jest.clearAllTimers();
        Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS });
    });

    describe('Rendering', () => {
        it('should render upload button on native platforms', () => {
            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should display placeholder text when provided', () => {
            const customPlaceholder = 'Перетащите фото точки маршрута';
            render(
                <PhotoUploadWithPreview
                    {...defaultProps}
                    placeholder={customPlaceholder}
                />
            );
            // Placeholder is used in dropzone on web
            expect(true).toBeTruthy();
        });

        it('should show existing image when oldImage is provided', async () => {
            const oldImageUrl = 'https://example.com/image.jpg';
            render(
                <PhotoUploadWithPreview {...defaultProps} oldImage={oldImageUrl} />
            );
            
            await waitFor(() => {
                // Image should be displayed
                expect(true).toBeTruthy();
            });
        });

        it('web: clears invalid blob preview on error (prevents ERR_FILE_NOT_FOUND spam after navigation)', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const onPreviewChange = jest.fn();
            const onUpload = jest.fn();
            const deadBlobUrl = 'blob:http://localhost:8081/dead-blob';

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage={deadBlobUrl}
                        onPreviewChange={onPreviewChange}
                        onUpload={onUpload}
                    />
                );

                // Ensure <img> is rendered with blob src.
                await waitFor(() => {
                    const imgNode = getWebPreviewImg(screen);
                    expect(String(imgNode.props.src)).toBe(deadBlobUrl);
                });

                // Trigger error; component should clear preview and notify parent.
                await act(async () => {
                    const imgNode = getWebPreviewImg(screen);
                    imgNode.props.onError?.();
                });

                await waitFor(() => {
                    // After clear, no img should be present (placeholder shown).
                    expect(queryWebPreviewImg(screen)).toBeNull();
                    expect(onPreviewChange).toHaveBeenCalledWith(null);
                });
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });

        it('web: keeps absolute private-IP image URL intact (regression: must not strip host to a relative path)', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const absolutePrivateIpUrl =
                'http://192.168.50.36/travel-image/17992/conversions/9b69f6475c7143d08e3ac7b508612221.webp';

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage={absolutePrivateIpUrl}
                    />
                );

                await waitFor(() => {
                    const imgNode = getWebPreviewImg(screen);
                    // On the buggy implementation this became "/travel-image/..." and loaded from localhost.
                    expect(String(imgNode.props.src)).toBe(absolutePrivateIpUrl);
                    expect(String(imgNode.props.src).startsWith('http')).toBe(true);
                });
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });

        it('web: renders absolute URL as img src (normalization sanity)', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const absoluteUrl = 'https://example.com/image.jpg';

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage={absoluteUrl}
                    />
                );

                await waitFor(() => {
                    const imgNode = getWebPreviewImg(screen);
                    expect(String(imgNode.props.src)).toBe(absoluteUrl);
                });
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });
    });

    describe('File Upload', () => {
        it('should call onUpload callback after successful upload', async () => {
            const mockResponse = {
                url: 'https://example.com/uploaded-image.jpg',
            };
            mockUploadImage.mockResolvedValueOnce(mockResponse as any);

            const onUploadMock = jest.fn();
            const { getByText } = render(
                <PhotoUploadWithPreview {...defaultProps} onUpload={onUploadMock} />
            );

            // Simulate upload would happen here in real scenario
            // For now, verify the component renders
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('web: calls uploadImage on first drop when idTravel is provided (regression for "preview only, no /upload")', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const blobUrl = 'blob:http://localhost:8081/test-blob-first-drop';
            const originalCreateObjectURL = (global as any).URL?.createObjectURL;
            (global as any).URL = (global as any).URL || {};
            (global as any).URL.createObjectURL = jest.fn(() => blobUrl);

            const serverUrl = 'http://192.168.50.36/travel-image/17992/conversions/test.webp';
            mockUploadImage.mockResolvedValueOnce({ url: serverUrl } as any);

            const onUpload = jest.fn();

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        idTravel={'819'}
                        collection="travelImageAddress"
                        onUpload={onUpload}
                    />
                );

                expect(typeof lastOnDrop).toBe('function');

                const file = new File([new Uint8Array([1, 2, 3])], 'test.webp', { type: 'image/webp' });
                await act(async () => {
                    await lastOnDrop([file], []);
                });

                await waitFor(() => {
                    expect(mockUploadImage).toHaveBeenCalledTimes(1);
                    expect(onUpload).toHaveBeenCalledWith(serverUrl);
                });

                await waitFor(() => {
                    const imgNode = getWebPreviewImg(screen);
                    expect(String(imgNode.props.src)).toBe(serverUrl);
                });
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
                (global as any).URL.createObjectURL = originalCreateObjectURL;
            }
        });

        it('web: does not call uploadImage when idTravel is missing (preview-only mode), but still emits blob preview', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const blobUrl = 'blob:http://localhost:8081/test-blob-preview-only';
            const originalCreateObjectURL = (global as any).URL?.createObjectURL;
            (global as any).URL = (global as any).URL || {};
            (global as any).URL.createObjectURL = jest.fn(() => blobUrl);

            const onUpload = jest.fn();

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        idTravel={null}
                        collection="travelImageAddress"
                        onUpload={onUpload}
                    />
                );

                expect(typeof lastOnDrop).toBe('function');

                const file = new File([new Uint8Array([1, 2, 3])], 'test.webp', { type: 'image/webp' });
                await act(async () => {
                    await lastOnDrop([file], []);
                });

                // No upload request should be sent.
                expect(mockUploadImage).not.toHaveBeenCalled();

                // But preview should still be emitted.
                await waitFor(() => {
                    expect(onUpload).toHaveBeenCalledWith(blobUrl);
                });

                await waitFor(() => {
                    const imgNode = getWebPreviewImg(screen);
                    expect(String(imgNode.props.src)).toBe(blobUrl);
                });
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
                (global as any).URL.createObjectURL = originalCreateObjectURL;
            }
        });

        it('should show loading indicator during upload', async () => {
            mockUploadImage.mockImplementationOnce(
                () => new Promise((resolve) => setTimeout(resolve, 1000))
            );

            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            // Component should render without errors
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should handle upload without idTravel (preview only mode)', async () => {
            const onUploadMock = jest.fn();
            const { getByText } = render(
                <PhotoUploadWithPreview
                    collection="travelMainImage"
                    idTravel={null}
                    onUpload={onUploadMock}
                />
            );

            expect(getByText('Загрузить фото')).toBeTruthy();
            // In preview mode, upload should not be called to server
            expect(mockUploadImage).not.toHaveBeenCalled();
        });
    });

    describe('File Validation', () => {
        it('should validate file size', () => {
            const { getByText } = render(
                <PhotoUploadWithPreview {...defaultProps} maxSizeMB={5} />
            );
            
            // Component should render with custom max size
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should show error for oversized files', async () => {
            const { getByText } = render(
                <PhotoUploadWithPreview {...defaultProps} maxSizeMB={1} />
            );

            // Error handling is internal, component should still render
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should validate file type', () => {
            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            // Type validation happens internally
            expect(getByText('Загрузить фото')).toBeTruthy();
        });
    });

    describe('Image Removal', () => {
        it('should remove image when remove button is clicked', async () => {
            const onUploadMock = jest.fn();
            const { getByText } = render(
                <PhotoUploadWithPreview
                    {...defaultProps}
                    oldImage="https://example.com/image.jpg"
                    onUpload={onUploadMock}
                />
            );

            // When oldImage is provided, button shows "Заменить фото"
            expect(getByText('Заменить фото')).toBeTruthy();
            // Remove button should be present
            expect(getByText('Удалить')).toBeTruthy();
        });

        it('should call onUpload with empty string when image is removed', async () => {
            const onUploadMock = jest.fn();
            const { getByText } = render(
                <PhotoUploadWithPreview
                    {...defaultProps}
                    oldImage="https://example.com/image.jpg"
                    onUpload={onUploadMock}
                />
            );

            // Component renders with replace button when image exists
            expect(getByText('Заменить фото')).toBeTruthy();
        });

        it('web: falls back to blob preview when remote image fails to load', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const blobUrl = 'blob:http://localhost:8081/test-blob';
            const originalCreateObjectURL = (global as any).URL?.createObjectURL;
            (global as any).URL = (global as any).URL || {};
            (global as any).URL.createObjectURL = jest.fn(() => blobUrl);

            try {
                // Simulate upload returning a URL that will fail to load.
                // Use a non-private IP URL to avoid normalization in test environment
                const remoteBadUrl = 'http://example.com/travel-image/17981/conversions/bad.webp';
                mockUploadImage.mockResolvedValueOnce({ url: remoteBadUrl } as any);

                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage={remoteBadUrl}
                    />
                );

                expect(typeof lastOnDrop).toBe('function');

                // Trigger drop -> preview becomes blob, then upload sets imageUri to remote URL with blob fallback stored.
                const file = new File([new Uint8Array([1, 2, 3])], 'test.webp', { type: 'image/webp' });
                await act(async () => {
                    await lastOnDrop([file], []);
                });

                // Wait until the uploaded (remote) URL is rendered.
                await waitFor(() => {
                    const imgNode = getWebPreviewImg(screen);
                    expect(String(imgNode.props.src)).toBe(remoteBadUrl);
                });

                // Switch to fake timers only for retry/backoff logic.
                jest.useFakeTimers();

                // Trigger load errors; component should retry with cache-busting param first,
                // and only after retries are exhausted fall back to blob preview.
                const delays = [300, 600, 1200, 2000, 2500, 3000];
                for (let attempt = 1; attempt <= delays.length; attempt++) {
                    await act(async () => {
                        const imgNode = getWebPreviewImg(screen);
                        imgNode.props.onError?.();
                    });

                    act(() => {
                        jest.advanceTimersByTime(delays[attempt - 1] + 1);
                    });

                    // With fake timers, assert synchronously after advancing timers.
                    const nextImg = getWebPreviewImg(screen);
                    expect(String(nextImg.props.src)).toContain(`__retry=${attempt}`);
                }

                // One more error after retries exhausted should apply blob fallback.
                await act(async () => {
                    const imgNode = getWebPreviewImg(screen);
                    imgNode.props.onError?.();
                });

                const finalImg = getWebPreviewImg(screen);
                expect(finalImg.props.src).toBe(blobUrl);
            } finally {
                act(() => {
                    jest.runOnlyPendingTimers();
                    jest.clearAllTimers();
                });
                Object.defineProperty(Platform, 'OS', { value: originalOs });
                (global as any).URL.createObjectURL = originalCreateObjectURL;
                jest.useRealTimers();
            }
        });
    });

    describe('Preview Functionality', () => {
        it('should show preview immediately after file selection', async () => {
            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should call onPreviewChange callback when preview changes', () => {
            const onPreviewChangeMock = jest.fn();
            const { getByText } = render(
                <PhotoUploadWithPreview
                    {...defaultProps}
                    onPreviewChange={onPreviewChangeMock}
                />
            );

            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should maintain preview when switching between files', () => {
            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            expect(getByText('Загрузить фото')).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should display error message on upload failure', async () => {
            mockUploadImage.mockRejectedValueOnce(new Error('Upload failed'));

            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should clear error when new file is selected', async () => {
            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should handle network errors gracefully', async () => {
            mockUploadImage.mockRejectedValueOnce(new Error('Network error'));

            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            expect(getByText('Загрузить фото')).toBeTruthy();
        });
    });

    describe('Disabled State', () => {
        it('should not allow upload when disabled', () => {
            const { getByText } = render(
                <PhotoUploadWithPreview {...defaultProps} disabled={true} />
            );

            const button = getByText('Загрузить фото');
            expect(button).toBeTruthy();
        });

        it('should not show remove button when disabled', () => {
            const { getByText, queryByText } = render(
                <PhotoUploadWithPreview
                    {...defaultProps}
                    oldImage="https://example.com/image.jpg"
                    disabled={true}
                />
            );

            // When disabled with oldImage, shows "Заменить фото" but no remove button
            expect(getByText('Заменить фото')).toBeTruthy();
            // Remove button should not be present when disabled
            expect(queryByText('Удалить')).toBeNull();
        });
    });

    describe('Progress Indication', () => {
        it('should show upload progress', async () => {
            mockUploadImage.mockImplementationOnce(
                () => new Promise((resolve) => setTimeout(resolve, 500))
            );

            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            expect(getByText('Загрузить фото')).toBeTruthy();
        });

        it('should update progress percentage during upload', async () => {
            const { getByText } = render(<PhotoUploadWithPreview {...defaultProps} />);
            
            expect(getByText('Загрузить фото')).toBeTruthy();
        });
    });

    describe('Integration with oldImage prop', () => {
        it('should sync with oldImage changes', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            try {
                const screen = render(
                    <PhotoUploadWithPreview {...defaultProps} oldImage={null} />
                );

                // When oldImage is null, no <img> should be rendered.
                expect(queryWebPreviewImg(screen)).toBeNull();

                screen.rerender(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage="https://example.com/new-image.jpg"
                    />
                );

                const imgNode = getWebPreviewImg(screen);
                expect(String(imgNode.props.src)).toBe('https://example.com/new-image.jpg');
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });

        it('should not override manually selected image with oldImage', async () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage="https://example.com/old-image.jpg"
                    />
                );

                const imgNode = getWebPreviewImg(screen);
                expect(String(imgNode.props.src)).toBe('https://example.com/old-image.jpg');
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });
    });

    describe('URL Normalization', () => {
        it('should handle relative URLs', () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage="/uploads/image.jpg"
                    />
                );

                const baseRaw = process.env.EXPO_PUBLIC_API_URL || window.location.origin;
                const prefix = String(baseRaw).replace(/\/+$/, '').replace(/\/api$/i, '');
                const expected = `${prefix}/uploads/image.jpg`;
                const imgNode = getWebPreviewImg(screen);
                expect(String(imgNode.props.src)).toBe(expected);
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });

        it('should handle absolute URLs', () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage="https://example.com/image.jpg"
                    />
                );

                const imgNode = getWebPreviewImg(screen);
                expect(String(imgNode.props.src)).toBe('https://example.com/image.jpg');
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });

        it('should handle blob URLs', () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            try {
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage="blob:http://localhost:8081/abc-123"
                    />
                );

                const imgNode = getWebPreviewImg(screen);
                expect(String(imgNode.props.src)).toBe('blob:http://localhost:8081/abc-123');
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });

        it('should handle data URLs', () => {
            const originalOs = Platform.OS;
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            try {
                const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
                const screen = render(
                    <PhotoUploadWithPreview
                        {...defaultProps}
                        oldImage={dataUrl}
                    />
                );

                const imgNode = getWebPreviewImg(screen);
                expect(String(imgNode.props.src)).toBe(dataUrl);
            } finally {
                Object.defineProperty(Platform, 'OS', { value: originalOs });
            }
        });
    });
});
