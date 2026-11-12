// #3312 (б): отложенная догрузка (`uploadPendingIfPossible`) и общий `loading`.
//
// Файл, выбранный до появления `idTravel`, ждёт в очереди и уходит на сервер,
// когда id появился. `loading` при этом держит сохранение формы (#3213), и у
// него два возможных владельца: открытый выбор или загрузка нового файла и сама
// догрузка. Каждый снимает блокировку только за себя.
import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { usePhotoUpload, type UsePhotoUploadOptions } from '@/hooks/usePhotoUpload';
import { uploadImage } from '@/api/misc';
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload';

jest.mock('@/api/misc', () => ({ uploadImage: jest.fn() }));
jest.mock('@/utils/webImageUpload', () => ({ prepareWebImageFileForUpload: jest.fn(async (file: File) => file), HeicConversionError: class extends Error {} }));

const originalOS = Platform.OS;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  jest.clearAllMocks();
  // Ответ, заготовленный тестом, где догрузка не стартовала, не должен достаться следующему.
  jest.mocked(uploadImage).mockReset();
  jest.mocked(prepareWebImageFileForUpload).mockImplementation(async (file) => file);
  URL.createObjectURL = jest.fn(() => 'blob:cover-preview');
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));

const UPLOADED = 'https://example.com/cover.jpg';
const queuedFile = () => new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' });

/** Хук без id с файлом в очереди; сетевой ответ догрузки управляется тестом. */
async function withQueuedFile(overrides: Partial<UsePhotoUploadOptions> = {}) {
  let resolveUpload!: (value: { url: string }) => void;
  let rejectUpload!: (error: Error) => void;
  jest.mocked(uploadImage).mockImplementationOnce(() => new Promise((resolve, reject) => { resolveUpload = resolve; rejectUpload = reject; }));
  const onUpload = jest.fn();
  const base: UsePhotoUploadOptions = { collection: 'travelMainImage', idTravel: null, onUpload, ...overrides };
  const screen = await renderHook((props: UsePhotoUploadOptions) => usePhotoUpload(props), { initialProps: base });
  await act(async () => { await screen.result.current.handleUploadImage(queuedFile()); });
  expect(uploadImage).not.toHaveBeenCalled();
  expect(screen.result.current.loading).toBe(false);
  onUpload.mockClear();
  const assignId = async () => { await act(async () => { await screen.rerender({ ...base, idTravel: '42' }); }); };
  return { screen, onUpload, assignId, resolveUpload: () => resolveUpload({ url: UPLOADED }), rejectUpload: () => rejectUpload(new Error('network')) };
}

it('uploads the queued file once the id appears and releases the lock itself', async () => {
  const { screen, onUpload, assignId, resolveUpload } = await withQueuedFile();
  await assignId();
  expect(uploadImage).toHaveBeenCalledTimes(1);
  expect(screen.result.current.loading).toBe(true);
  await act(async () => { resolveUpload(); });
  expect(screen.result.current.loading).toBe(false);
  expect(onUpload).toHaveBeenCalledWith(UPLOADED);
});

it('keeps the save lock of an open selection when the deferred upload finishes first', async () => {
  const { screen, onUpload, assignId, resolveUpload } = await withQueuedFile();
  let selection!: ReturnType<typeof screen.result.current.beginSelection>;
  await act(async () => { selection = screen.result.current.beginSelection(); });
  expect(screen.result.current.loading).toBe(true);

  await assignId();
  await act(async () => { resolveUpload(); });

  expect(onUpload).toHaveBeenCalledWith(UPLOADED);
  // Выбор ещё открыт (система отдаёт файл): сохранять форму по-прежнему нельзя.
  expect(screen.result.current.loading).toBe(true);
  await act(async () => { selection.end(); });
  expect(screen.result.current.loading).toBe(false);
});

it('keeps the lock of a running deferred upload when a selection opened meanwhile is dismissed', async () => {
  const { screen, assignId, resolveUpload } = await withQueuedFile();
  await assignId();
  let selection!: ReturnType<typeof screen.result.current.beginSelection>;
  await act(async () => { selection = screen.result.current.beginSelection(); });
  await act(async () => { selection.end(); });
  // Пикер закрыт без файла, но очередь ещё на сервере.
  expect(screen.result.current.loading).toBe(true);
  await act(async () => { resolveUpload(); });
  expect(screen.result.current.loading).toBe(false);
});

it('keeps the lock while a newly chosen file is still uploading after the deferred upload ends', async () => {
  const { screen, onUpload, assignId, resolveUpload } = await withQueuedFile();
  await assignId();
  let resolveSecond!: (value: { url: string }) => void;
  jest.mocked(uploadImage).mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
  let second!: Promise<void>;
  await act(async () => { second = screen.result.current.handleUploadImage(new File(['png'], 'next.png', { type: 'image/png' })); });
  await act(async () => { resolveUpload(); });
  expect(screen.result.current.loading).toBe(true);
  await act(async () => { resolveSecond({ url: 'https://example.com/next.png' }); await second; });
  expect(screen.result.current.loading).toBe(false);
  expect(onUpload).toHaveBeenLastCalledWith('https://example.com/next.png');
});

it('does not deliver the deferred result after an explicit cancel', async () => {
  const { screen, onUpload, assignId, resolveUpload } = await withQueuedFile({ oldImage: 'https://example.com/old.jpg' });
  await assignId();
  await act(async () => { screen.result.current.cancelUpload(); });
  expect(screen.result.current.loading).toBe(false);
  await act(async () => { resolveUpload(); });
  expect(onUpload).not.toHaveBeenCalled();
  expect(screen.result.current.loading).toBe(false);
  expect(screen.result.current.currentDisplayUrl).toBe('https://example.com/old.jpg');
  expect(screen.result.current.uploadMessage).toBeNull();
});

it('releases the lock and keeps the file queued when the deferred upload fails', async () => {
  const onError = jest.fn();
  const { screen, onUpload, assignId, rejectUpload } = await withQueuedFile({ onError });
  await assignId();
  await act(async () => { rejectUpload(); });
  expect(screen.result.current.loading).toBe(false);
  expect(onUpload).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledWith('Произошла ошибка при загрузке');
});

// #3314 (д): файл очереди перестаёт быть выбором автора, когда выбран новый файл или
// нажата отмена, — независимо от того, успела ли догрузка стартовать.
describe('a queued file that is no longer the author\'s choice', () => {
  const NEXT = 'https://example.com/next.png';
  const nextFile = () => new File(['png'], 'next.png', { type: 'image/png' });

  it('does not let the deferred answer of the old file replace the preview of a newly chosen one', async () => {
    const { screen, onUpload, assignId, resolveUpload } = await withQueuedFile();
    await assignId();
    let resolveSecond!: (value: { url: string }) => void;
    jest.mocked(uploadImage).mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    jest.mocked(URL.createObjectURL).mockReturnValueOnce('blob:next-preview');
    let second!: Promise<void>;
    await act(async () => { second = screen.result.current.handleUploadImage(nextFile()); });
    expect(screen.result.current.currentDisplayUrl).toBe('blob:next-preview');

    await act(async () => { resolveUpload(); });
    expect(onUpload).not.toHaveBeenCalledWith(UPLOADED);
    expect(screen.result.current.currentDisplayUrl).toBe('blob:next-preview');
    expect(screen.result.current.uploadMessage).toBeNull();

    await act(async () => { resolveSecond({ url: NEXT }); await second; });
    expect(onUpload.mock.calls).toEqual([[NEXT]]);
    expect(screen.result.current.currentDisplayUrl).toBe(NEXT);
  });

  it('neither reports nor re-queues a failed deferred upload of a replaced file', async () => {
    const onError = jest.fn();
    const { screen, onUpload, assignId, rejectUpload } = await withQueuedFile({ onError });
    await assignId();
    jest.mocked(uploadImage).mockResolvedValueOnce({ url: NEXT });
    await act(async () => { await screen.result.current.handleUploadImage(nextFile()); });
    await act(async () => { rejectUpload(); });
    expect(onError).not.toHaveBeenCalled();
    expect(onUpload.mock.calls).toEqual([[NEXT]]);
    // Прежний файл не вернулся в очередь: повторной догрузки нет.
    await act(async () => { await screen.rerender({ collection: 'travelMainImage', idTravel: '42', onUpload, onError, oldImage: NEXT }); });
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(screen.result.current.currentDisplayUrl).toBe(NEXT);
  });

  it('drops the queued file on an explicit cancel before the upload has started', async () => {
    const { screen, onUpload, assignId } = await withQueuedFile({ oldImage: 'https://example.com/old.jpg' });
    await act(async () => { screen.result.current.cancelUpload(); });
    await assignId();
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.result.current.loading).toBe(false);
    expect(screen.result.current.currentDisplayUrl).toBe('https://example.com/old.jpg');
  });

  it('does not bring a removed photo back with the deferred answer', async () => {
    const { screen, onUpload, assignId, resolveUpload } = await withQueuedFile();
    await assignId();
    await act(async () => { screen.result.current.handleRemovePress(); });
    onUpload.mockClear();
    await act(async () => { resolveUpload(); });
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.result.current.hasValidImage).toBe(false);
  });
});
