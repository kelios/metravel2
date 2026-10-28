import { getTravelWizardCoverUrl } from '@/utils/travelWizardCover';

describe('getTravelWizardCoverUrl', () => {
  it.each([
    '/gallery/photo.webp',
    'gallery/photo.webp',
    'https://metravel.by/gallery/photo.webp?w=320',
    '//cdn.example.com/media/gallery/photo.webp#preview',
  ])('rejects gallery display fallback %s', (url) => {
    expect(getTravelWizardCoverUrl(url, null, ['', url])).toBeNull();
  });

  it.each([
    '/travel-image/42/cover.webp',
    'https://cdn.example.com/cover.webp?source=/gallery/photo.webp',
    'blob:local-preview',
    'file:///local/cover.jpg',
    'data:image/png;base64,abc',
    '3796',
  ])('preserves own cover or upload reference %s', (url) => {
    expect(getTravelWizardCoverUrl(undefined, '', ` ${url} `)).toBe(url);
  });

  it('skips a fallback and empty legacy arrays to find an own cover', () => {
    expect(getTravelWizardCoverUrl('/gallery/photo.webp', [], ['/travel-image/cover.webp']))
      .toBe('/travel-image/cover.webp');
  });
});
