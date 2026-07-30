import {
  compressWebRasterImage,
  isHeicLikeFile,
  prepareWebImageFileForUpload,
  HeicConversionError,
} from '@/utils/webImageUpload';

const mockHeicTo = jest.fn(async () => new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }));

jest.mock('heic-to', () => ({
  __esModule: true,
  heicTo: (...args: unknown[]) => mockHeicTo(...args),
}));

describe('webImageUpload', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalImage = global.Image;
  const originalDocumentCreateElement = document.createElement.bind(document);

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.Image = originalImage;
    jest.restoreAllMocks();
  });

  it('detects HEIC by mime type and extension', () => {
    expect(isHeicLikeFile(new File(['a'], 'iphone.heic', { type: 'image/heic' }))).toBe(true);
    expect(isHeicLikeFile(new File(['a'], 'iphone.heif', { type: '' }))).toBe(true);
    expect(isHeicLikeFile(new File(['a'], 'photo.jpg', { type: 'image/jpeg' }))).toBe(false);
  });

  it('converts HEIC to JPEG file for upload', async () => {
    const source = new File([new Uint8Array([1, 2, 3])], 'iphone.heic', { type: 'image/heic' });

    const converted = await prepareWebImageFileForUpload(source);

    expect(converted).toBeInstanceOf(File);
    expect(converted).not.toBe(source);
    expect(converted.type).toBe('image/jpeg');
    expect(converted.name).toBe('iphone.jpg');
  });

  it('leaves non-HEIC files unchanged', async () => {
    const source = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });

    const converted = await prepareWebImageFileForUpload(source);

    expect(converted).toBe(source);
  });

  it('compresses oversized web JPEGs before upload validation', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:test-large-photo');
    URL.revokeObjectURL = jest.fn();

    class MockImage {
      naturalWidth = 5712;
      naturalHeight = 4284;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }

    global.Image = MockImage as unknown as typeof Image;

    const createElementSpy = jest.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() !== 'canvas') {
        return originalDocumentCreateElement(tagName);
      }

      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: jest.fn() }),
        toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
          expect(type).toBe('image/jpeg');
          expect(quality).toBeLessThan(1);
          callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
        },
      } as unknown as HTMLCanvasElement;
    });

    const source = new File([new Uint8Array(10 * 1024 * 1024 + 128)], 'waterfall.jpg', {
      type: 'image/jpeg',
    });

    const converted = await prepareWebImageFileForUpload(source);

    expect(converted).toBeInstanceOf(File);
    expect(converted).not.toBe(source);
    expect(converted.name).toBe('waterfall.jpg');
    expect(converted.type).toBe('image/jpeg');
    expect(converted.size).toBeLessThan(source.size);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-large-photo');
  });

  it('compresses oversized web PNGs to JPEG before upload validation', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:test-large-png');
    URL.revokeObjectURL = jest.fn();

    class MockImage {
      naturalWidth = 4032;
      naturalHeight = 3024;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }

    global.Image = MockImage as unknown as typeof Image;

    const createElementSpy = jest.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() !== 'canvas') {
        return originalDocumentCreateElement(tagName);
      }

      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: jest.fn() }),
        toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
          expect(type).toBe('image/jpeg');
          expect(quality).toBeLessThan(1);
          callback(new Blob([new Uint8Array([4, 5, 6])], { type: 'image/jpeg' }));
        },
      } as unknown as HTMLCanvasElement;
    });

    const source = new File([new Uint8Array(10 * 1024 * 1024 + 128)], 'map-capture.png', {
      type: 'image/png',
    });

    const converted = await prepareWebImageFileForUpload(source);

    expect(converted).toBeInstanceOf(File);
    expect(converted).not.toBe(source);
    expect(converted.name).toBe('map-capture.jpg');
    expect(converted.type).toBe('image/jpeg');
    expect(converted.size).toBeLessThan(source.size);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-large-png');
  });

  // #1164: раньше решение принималось только по весу файла — фото 6000×4000 на 8 МБ
  // уезжало целиком, чтобы сервер срезал его до 1920. Теперь основной признак —
  // размер в пикселях, а вес остался вторым триггером.
  describe('compressWebRasterImage — решение по пикселям, не по весу (#1164)', () => {
    let toBlobCalls: Array<{ type: string; quality: number }> = [];
    let canvasSizes: Array<{ width: number; height: number }> = [];

    const mockCanvasPipeline = (
      naturalWidth: number,
      naturalHeight: number,
      encodedBytes: number,
    ) => {
      URL.createObjectURL = jest.fn(() => 'blob:test');
      URL.revokeObjectURL = jest.fn();

      class MockImage {
        naturalWidth = naturalWidth;
        naturalHeight = naturalHeight;
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;

        set src(_value: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      global.Image = MockImage as unknown as typeof Image;

      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName.toLowerCase() !== 'canvas') return originalDocumentCreateElement(tagName);

        const canvas: any = {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: jest.fn(), fillRect: jest.fn(), fillStyle: '' }),
          toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
            toBlobCalls.push({ type, quality });
            canvasSizes.push({ width: canvas.width, height: canvas.height });
            callback(new Blob([new Uint8Array(encodedBytes)], { type: 'image/jpeg' }));
          },
        };
        return canvas as HTMLCanvasElement;
      });
    };

    beforeEach(() => {
      toBlobCalls = [];
      canvasSizes = [];
    });

    it('жмёт фото 6000×4000 весом 5 МБ, хотя порог по весу не превышен', async () => {
      mockCanvasPipeline(6000, 4000, 400 * 1024);
      const source = new File([new Uint8Array(5 * 1024 * 1024)], 'sunset.jpg', { type: 'image/jpeg' });

      const result = await compressWebRasterImage(source);

      expect(result).not.toBe(source);
      expect(result.size).toBeLessThan(source.size);
      // Длинная сторона приведена к 2500 — `PRINT_IMAGE_MAX_SIZE` бэкенда.
      expect(canvasSizes[0]).toEqual({ width: 2500, height: 1667 });
    });

    it('не трогает фото 1600×1200 весом 3 МБ: пикселей мало, вес в бюджете', async () => {
      mockCanvasPipeline(1600, 1200, 100 * 1024);
      const source = new File([new Uint8Array(3 * 1024 * 1024)], 'small.jpg', { type: 'image/jpeg' });

      expect(await compressWebRasterImage(source)).toBe(source);
      expect(toBlobCalls).toHaveLength(0);
    });

    // Downscale тут не поможет — файл нужно именно пережать, иначе бэкенд ответит 400
    // (`MAX_IMAGE_UPLOAD_SIZE = 10 MB`).
    it('всё ещё пережимает тяжёлый файл со скромными размерами в пикселях', async () => {
      mockCanvasPipeline(2000, 2000, 700 * 1024);
      const source = new File([new Uint8Array(9 * 1024 * 1024 + 1)], 'poster.png', { type: 'image/png' });

      const result = await compressWebRasterImage(source);

      expect(result).not.toBe(source);
      expect(result.size).toBeLessThan(source.size);
      // Размеры в пикселях сохранены — резать было нечего.
      expect(canvasSizes[0]).toEqual({ width: 2000, height: 2000 });
    });

    // Сценарий «гружу максимальное качество для PDF»: print-вариант на бэкенде — 2500,
    // и клиентский downscale не должен обрезать то, что ему нужно.
    it('оставляет ровно 2500 нетронутым — это верхняя сторона print-варианта', async () => {
      mockCanvasPipeline(2500, 1800, 300 * 1024);
      const source = new File([new Uint8Array(4 * 1024 * 1024)], 'print.jpg', { type: 'image/jpeg' });

      expect(await compressWebRasterImage(source)).toBe(source);
      expect(toBlobCalls).toHaveLength(0);
    });

    // Правило по пикселям требует декодировать файл, а декод — цена на КАЖДОЙ
    // загрузке. Ниже 512 КБ выигрыш от downscale исчезающе мал, поэтому файл даже
    // не открывается.
    it('не декодирует лёгкий файл вовсе', async () => {
      mockCanvasPipeline(6000, 4000, 10 * 1024);
      const source = new File([new Uint8Array(3)], 'thumb.jpg', { type: 'image/jpeg' });

      expect(await compressWebRasterImage(source)).toBe(source);
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(toBlobCalls).toHaveLength(0);
    });

    // Браузер не гарантирует ни `onload`, ни `onerror` — на битом файле оба события
    // могут не прийти. Без ограничения ожидания загрузка висела бы вечно.
    it('не подвешивает загрузку, если файл не декодируется', async () => {
      jest.useFakeTimers();
      try {
        URL.createObjectURL = jest.fn(() => 'blob:never-decodes');
        URL.revokeObjectURL = jest.fn();
        class SilentImage {
          naturalWidth = 0;
          naturalHeight = 0;
          onload: null | (() => void) = null;
          onerror: null | (() => void) = null;
          set src(_value: string) {
            /* ни load, ни error не приходят */
          }
        }
        global.Image = SilentImage as unknown as typeof Image;

        const source = new File([new Uint8Array(6 * 1024 * 1024)], 'broken.jpg', { type: 'image/jpeg' });
        const pending = compressWebRasterImage(source);
        jest.advanceTimersByTime(5000);

        expect(await pending).toBe(source);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:never-decodes');
      } finally {
        jest.useRealTimers();
      }
    });

    it('не трогает нерастровые типы', async () => {
      mockCanvasPipeline(6000, 4000, 10 * 1024);
      const svg = new File([new Uint8Array(64)], 'logo.svg', { type: 'image/svg+xml' });
      const gif = new File([new Uint8Array(64)], 'anim.gif', { type: 'image/gif' });

      expect(await compressWebRasterImage(svg)).toBe(svg);
      expect(await compressWebRasterImage(gif)).toBe(gif);
      expect(toBlobCalls).toHaveLength(0);
    });

    it('возвращает оригинал, если пережатие не дало выигрыша', async () => {
      mockCanvasPipeline(3000, 2000, 6 * 1024 * 1024);
      const source = new File([new Uint8Array(2 * 1024 * 1024)], 'already-tight.jpg', { type: 'image/jpeg' });

      expect(await compressWebRasterImage(source)).toBe(source);
    });
  });

  it('throws HeicConversionError instead of returning the raw HEIC when decode fails', async () => {
    mockHeicTo.mockRejectedValueOnce(new Error('ERR_LIBHEIF format not supported'));
    const source = new File([new Uint8Array([1, 2, 3])], 'iphone.heic', { type: 'image/heic' });

    await expect(prepareWebImageFileForUpload(source)).rejects.toBeInstanceOf(HeicConversionError);
  });
});
