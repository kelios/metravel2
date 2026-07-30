/**
 * #1150: картинки с недостижимого внутреннего хоста не рендерятся.
 *
 * В теле статьи `/travels/ourvietnam` осталось четыре ссылки на dev-хост
 * `http://travel.vm:8012/uploads/...`. Resize-прокси отвечает на них 404,
 * фолбэк на исходный адрес недостижим, оригиналы в S3 не сохранились
 * (проверено 2026-07-30: `s3=404`, `site=404`). Читатель видел пустую рамку
 * и платил лишним запросом к стороннему прокси.
 */
import { sanitizeRichText } from '@/utils/sanitizeRichText';

describe('sanitizeRichText: недостижимые хосты картинок', () => {
  it('выбрасывает img с внутреннего travel.vm', () => {
    const html =
      '<p><img src="http://travel.vm:8012/uploads/15902415341138_original.jpg" alt="a"></p>';
    const out = sanitizeRichText(html);

    expect(out).not.toContain('travel.vm');
    expect(out).not.toMatch(/<img[^>]*src=/);
  });

  it('оставляет рабочую картинку с S3', () => {
    const html =
      '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1591620319350_original.jpg" alt="b"></p>';
    const out = sanitizeRichText(html);

    expect(out).toMatch(/<img[^>]*src=/);
    expect(out).toContain('1591620319350_original.jpg');
  });

  it('оставляет собственные картинки metravel.by', () => {
    const html = '<p><img src="https://metravel.by/travel-description-image/1/photo.jpg"></p>';
    const out = sanitizeRichText(html);

    expect(out).toContain('metravel.by/travel-description-image/1/photo.jpg');
  });

  it('чистит смешанный набор, не трогая соседей', () => {
    const html =
      '<p><img src="http://travel.vm:8012/uploads/a.jpg"></p>' +
      '<p>текст</p>' +
      '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/b.jpg"></p>';
    const out = sanitizeRichText(html);

    expect(out).not.toContain('travel.vm');
    expect(out).toContain('текст');
    // #1163: соседняя S3-картинка остаётся на своём origin (раньше здесь был
    // percent-encoded `url=` внутри обёртки `images.weserv.nl`).
    expect(out).toContain('src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/b.jpg"');
    expect(out).not.toContain('images.weserv.nl');
  });
});
