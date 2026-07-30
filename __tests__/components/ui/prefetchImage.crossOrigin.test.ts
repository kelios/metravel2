/**
 * Регрессия семейства «каждый URL качается дважды» (#1074, #1114, #1142).
 *
 * `prefetchImage()` грел картинку через `new Image()` с `crossOrigin='anonymous'`,
 * а смонтированный `<img>` в ImageCardMedia рендерится БЕЗ `crossorigin`.
 * Ответы image-proxy отдаются с `Vary: Accept, origin`, поэтому CORS-режим
 * создаёт ОТДЕЛЬНУЮ запись в HTTP-кэше — один и тот же файл уезжает по сети
 * дважды (замер прода 2026-07-30: одно фото слайдера = 2–3 запроса по 66–89 КБ).
 *
 * Инвариант: prefetch и рендер используют один CORS-режим — без crossOrigin.
 */
import { Platform } from 'react-native';

import { prefetchImage } from '@/components/ui/OptimizedImage';

describe('prefetchImage — CORS-режим совпадает с <img>', () => {
  const created: { crossOrigin: string | null; src: string }[] = [];
  const OriginalImage = (global as any).Image;
  const originalOS = Platform.OS;

  beforeEach(() => {
    (Platform as any).OS = 'web';
    created.length = 0;
    (global as any).Image = class {
      crossOrigin: string | null = null;
      decoding = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      constructor() {
        created.push(this as any);
      }
      set src(value: string) {
        this._src = value;
        setTimeout(() => this.onload?.(), 0);
      }
      get src() {
        return this._src;
      }
    };
  });

  afterEach(() => {
    (global as any).Image = OriginalImage;
    (Platform as any).OS = originalOS;
  });

  it('не ставит crossOrigin для same-origin картинки', async () => {
    const uri = `${window.location.origin}/gallery/3995/conversions/one-detail_hd.jpg?w=640&q=75&fit=cover`;

    await prefetchImage(uri);

    expect(created).toHaveLength(1);
    expect(created[0].crossOrigin).toBeFalsy();
  });

  it('не ставит crossOrigin и для cross-origin картинки', async () => {
    const uri = 'https://images.weserv.nl/?url=example.com%2Fphoto.jpg&w=600';

    await prefetchImage(uri);

    expect(created).toHaveLength(1);
    expect(created[0].crossOrigin).toBeFalsy();
  });
});
