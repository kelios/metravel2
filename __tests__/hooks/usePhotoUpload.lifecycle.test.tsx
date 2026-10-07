import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { uploadImage } from '@/api/misc';
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload';

jest.mock('@/api/misc', () => ({ uploadImage: jest.fn() }));
jest.mock('@/utils/webImageUpload', () => ({ prepareWebImageFileForUpload: jest.fn(async (file: File) => file), HeicConversionError: class extends Error {} }));

const originalOS = Platform.OS;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  jest.clearAllMocks();
  jest.mocked(prepareWebImageFileForUpload).mockImplementation(async (file) => file);
  URL.createObjectURL = jest.fn(() => 'blob:point-preview');
  URL.revokeObjectURL = jest.fn();
});

it('finishes a point upload without allocating a preview after closing during file preparation', async () => {
  let finishPreparation!: (file: File) => void;
  jest.mocked(prepareWebImageFileForUpload).mockImplementationOnce(() => new Promise((resolve) => { finishPreparation = resolve; }));
  jest.mocked(uploadImage).mockResolvedValueOnce({ url: 'https://example.com/point.jpg' });
  const onUpload = jest.fn();
  const screen = renderHook(() => usePhotoUpload({ collection: 'travelImageAddress', idTravel: '42', onUpload }));
  const file = new File(['jpeg'], 'point.jpg', { type: 'image/jpeg' });
  let pending!: Promise<void>;
  await act(async () => { pending = screen.result.current.handleUploadImage(file); });
  screen.unmount();
  await act(async () => { finishPreparation(file); await pending; });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(onUpload).toHaveBeenCalledWith('https://example.com/point.jpg');
});
afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));

it.each([true, false])('delivers a server point photo after upload completion, unmounted=%s', async (unmounted) => {
  let resolveUpload!: (value: { url: string }) => void;
  jest.mocked(uploadImage).mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
  const onUpload = jest.fn();
  const screen = renderHook(() => usePhotoUpload({ collection: 'travelImageAddress', idTravel: '42', onUpload }));
  let pending!: Promise<void>;
  await act(async () => { pending = screen.result.current.handleUploadImage(new File(['jpeg'], 'point.jpg', { type: 'image/jpeg' })); });
  if (unmounted) screen.unmount();
  await act(async () => { resolveUpload({ url: 'https://example.com/point.jpg' }); await pending; });
  expect(onUpload).toHaveBeenCalledWith('https://example.com/point.jpg');
});

it.each([true, false])('never writes its disposable preview to an existing point when upload omits url, unmounted=%s', async (unmounted) => {
  let resolveUpload!: (value: { success: boolean }) => void;
  jest.mocked(uploadImage).mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
  const onUpload = jest.fn();
  const screen = renderHook(() => usePhotoUpload({ collection: 'travelImageAddress', idTravel: '42', oldImage: 'https://example.com/old.jpg', onUpload }));
  let pending!: Promise<void>;
  await act(async () => { pending = screen.result.current.handleUploadImage(new File(['jpeg'], 'point.jpg', { type: 'image/jpeg' })); });
  if (unmounted) screen.unmount();
  await act(async () => { resolveUpload({ success: true }); await pending; });
  expect(onUpload).not.toHaveBeenCalled();
  if (unmounted) expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:point-preview');
  else {
    expect(screen.result.current.currentDisplayUrl).toBe('https://example.com/old.jpg');
    expect(screen.result.current.error).toBe('Ошибка при загрузке');
    expect(screen.result.current.uploadMessage).toBeNull();
  }
});

it('preserves cover callback lifetime after the upload component unmounts', async () => {
  let resolveUpload!: (value: { url: string }) => void;
  jest.mocked(uploadImage).mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
  const onUpload = jest.fn();
  const screen = renderHook(() => usePhotoUpload({ collection: 'travelMainImage', idTravel: '42', onUpload }));
  let pending!: Promise<void>;
  await act(async () => { pending = screen.result.current.handleUploadImage(new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' })); });
  screen.unmount();
  await act(async () => { resolveUpload({ url: 'https://example.com/cover.jpg' }); await pending; });
  expect(onUpload).not.toHaveBeenCalled();
});
