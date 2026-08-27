import {
  groupConsecutiveImages,
  removeImageLayoutClasses,
  applySmartImageLayout,
} from '@/utils/richTextImageLayout';
import { ContentParser } from '@/services/pdf-export/parsers/ContentParser';

const landscape = (src = '1.jpg') => `<p><img src="${src}" width="1200" height="800"></p>`;
const portrait = (src = '1.jpg') => `<p><img src="${src}" width="600" height="900"></p>`;
const square = (src = '1.jpg') => `<p><img src="${src}" width="800" height="800"></p>`;

describe('richTextImageLayout (журнальная раскладка по ориентации и количеству)', () => {
  describe('одиночное фото', () => {
    it('ландшафт занимает всю ширину', () => {
      const result = groupConsecutiveImages(`<p>До</p>${landscape()}<p>После</p>`);
      expect(result).toContain('img-single-wide');
      expect(result).toContain('figure-landscape');
    });

    it('портрет обтекается текстом и чередует сторону', () => {
      const result = groupConsecutiveImages(
        `<p>Текст</p>${portrait('1.jpg')}<p>Текст</p>${portrait('2.jpg')}<p>Текст</p>`,
      );
      expect(result).toContain('img-float-right');
      expect(result).toContain('img-float-left');
      expect(result).toContain('figure-portrait');
    });
  });

  describe('пара фото — вариант выбирается ориентацией', () => {
    it('два портрета', () => {
      const result = groupConsecutiveImages(`<p>Т</p>${portrait('1.jpg')}${portrait('2.jpg')}<p>Т</p>`);
      expect(result).toContain('img-pair-portraits');
      expect(result).toContain('img-row-2-portrait');
    });

    it('два ландшафта', () => {
      const result = groupConsecutiveImages(`<p>Т</p>${landscape('1.jpg')}${landscape('2.jpg')}<p>Т</p>`);
      expect(result).toContain('img-stack-landscape');
      expect(result).toContain('img-row-2-landscape');
    });

    it('портрет + ландшафт', () => {
      const result = groupConsecutiveImages(`<p>Т</p>${portrait('1.jpg')}${landscape('2.jpg')}<p>Т</p>`);
      expect(result).toContain('img-pair-mixed');
      expect(result).toContain('img-row-2-mixed');
    });

    it('два квадрата', () => {
      const result = groupConsecutiveImages(`<p>Т</p>${square('1.jpg')}${square('2.jpg')}<p>Т</p>`);
      expect(result).toContain('img-pair-balanced');
      expect(result).toContain('img-row-2-balanced');
    });
  });

  describe('три и больше — вариант выбирается ориентацией и количеством', () => {
    it('портрет между двумя ландшафтами даёт лоскут из трёх', () => {
      const result = groupConsecutiveImages(
        `<p>Т</p>${landscape('1.jpg')}${portrait('2.jpg')}${landscape('3.jpg')}<p>Т</p>`,
      );
      expect(result).toContain('img-quilt-3');
      expect(result).toContain('img-grid-mixed');
      expect(result).toContain('img-grid-mixed-stack');
    });

    it('портрет первым разворачивает лоскут', () => {
      const result = groupConsecutiveImages(
        `<p>Т</p>${portrait('1.jpg')}${landscape('2.jpg')}${landscape('3.jpg')}<p>Т</p>`,
      );
      expect(result).toContain('img-grid-mixed-reverse');
    });

    it('три портрета дают триптих', () => {
      const result = groupConsecutiveImages(
        `<p>Т</p>${portrait('1.jpg')}${portrait('2.jpg')}${portrait('3.jpg')}<p>Т</p>`,
      );
      expect(result).toContain('img-portrait-triptych');
      expect(result).toContain('img-grid-portrait');
    });

    it('четыре портрета дают квартет', () => {
      const result = groupConsecutiveImages(
        `<p>Т</p>${portrait('1.jpg')}${portrait('2.jpg')}${portrait('3.jpg')}${portrait('4.jpg')}<p>Т</p>`,
      );
      expect(result).toContain('img-portrait-quartet');
    });

    it('четыре ландшафта дают лоскут из четырёх', () => {
      const result = groupConsecutiveImages(
        `<p>Т</p>${landscape('1.jpg')}${landscape('2.jpg')}${landscape('3.jpg')}${landscape('4.jpg')}<p>Т</p>`,
      );
      expect(result).toContain('img-quilt-4');
      expect(result).toContain('img-grid-quilt');
    });

    it('две пары разной ориентации дают сбалансированную сетку', () => {
      const result = groupConsecutiveImages(
        `<p>Т</p>${landscape('1.jpg')}${landscape('2.jpg')}${portrait('3.jpg')}${portrait('4.jpg')}<p>Т</p>`,
      );
      expect(result).toContain('img-pair-grid');
      expect(result).toContain('img-grid-balanced');
    });

    it('ландшафтная группа из пяти уходит в редакторскую сетку', () => {
      const images = [1, 2, 3, 4, 5].map((n) => landscape(`${n}.jpg`)).join('');
      const result = groupConsecutiveImages(`<p>Т</p>${images}<p>Т</p>`);
      expect(result).toContain('img-editorial-grid');
    });

    it('портретная группа из пяти собирается в колонки', () => {
      const images = [1, 2, 3, 4, 5].map((n) => portrait(`${n}.jpg`)).join('');
      const result = groupConsecutiveImages(`<p>Т</p>${images}<p>Т</p>`);
      expect(result).toContain('img-column-portraits');
      expect(result).toContain('img-grid-portrait');
    });
  });

  // Разметка редактора почти никогда не несёт width/height. На web резерв
  // `aspect-ratio:800/450` подставляет normalizeImgTags, а PDF-экспорт
  // раскладывает сырое описание — раскладка обязана совпасть на обеих сторонах.
  describe('фото без объявленных размеров (сырое описание, как в PDF-экспорте)', () => {
    const bare = (src = '1.jpg') => `<p><img src="${src}"></p>`;

    it('одиночное фото занимает всю ширину, а не уезжает в 56%-колонку', () => {
      const result = groupConsecutiveImages(`<p>Текст</p>${bare('1.jpg')}<p>Текст</p>${bare('2.jpg')}<p>Текст</p>`);
      expect(result).toContain('img-single-wide');
      expect(result).not.toContain('img-float-right');
      expect(result).not.toContain('img-float-left');
    });

    it('группа собирается в ту же раскладку, что и на странице с резервными пропорциями', () => {
      const withReserve = (src: string) => `<p><img src="${src}" style="aspect-ratio:800/450"></p>`;
      const group = (build: (src: string) => string) =>
        groupConsecutiveImages(`<p>Т</p>${build('1.jpg')}${build('2.jpg')}${build('3.jpg')}${build('4.jpg')}<p>Т</p>`);

      const raw = group(bare);
      expect(raw).toContain('img-quilt-4');
      // Тот же набор кадров на web (с резервом) даёт ту же обёртку — книга и
      // страница не расходятся.
      expect(group(withReserve)).toContain('img-quilt-4');
    });

    it('объявленный квадрат по-прежнему обтекается', () => {
      const result = groupConsecutiveImages(`<p>Т</p>${square('1.jpg')}<p>Т</p>`);
      expect(result).toContain('img-float-right');
    });
  });

  // Описание из редактора приходит с переводами строк между абзацами; раньше
  // такой фрагмент считался контентом и обрывал группу — журнальные раскладки
  // не собирались вообще.
  describe('переводы строк между абзацами', () => {
    it('не разрывают группу подряд идущих фото', () => {
      const result = groupConsecutiveImages(
        `<p>Т</p>\n${landscape('1.jpg')}\n${landscape('2.jpg')}\n<p>Т</p>`,
      );
      expect(result).toContain('img-stack-landscape');
    });

    it('не склеивают фото через текстовый абзац', () => {
      const result = groupConsecutiveImages(
        `${landscape('1.jpg')}\n<p>Текст между</p>\n${landscape('2.jpg')}`,
      );
      expect(result).not.toContain('img-stack-landscape');
      expect(result).toContain('img-single-wide');
      expect(result).toContain('<p>Текст между</p>');
    });
  });

  describe('базовые случаи', () => {
    it('пустая строка остаётся пустой', () => {
      expect(groupConsecutiveImages('')).toBe('');
    });

    it('текст без картинок не меняется', () => {
      const html = '<p>Hello world</p><p>Another paragraph</p>';
      expect(groupConsecutiveImages(html)).toBe(html);
    });

    it('несколько картинок в одном абзаце разворачиваются перед группировкой', () => {
      const html = '<p>Т</p><p><img src="1.jpg" width="700" height="900"><img src="2.jpg" width="1200" height="700"><img src="3.jpg" width="700" height="900"></p><p>Т</p>';
      const result = groupConsecutiveImages(html);
      expect(result).not.toContain('<img src="1.jpg" width="700" height="900"><img src="2.jpg"');
      expect(result).toMatch(/img-(quilt|grid|row-2|portrait|column|pair|stack|editorial)/);
    });

    it('картинка с <br> тоже раскладывается', () => {
      const result = groupConsecutiveImages('<p><img src="test.jpg" width="600" height="800"><br></p>');
      expect(result).toContain('figure-portrait');
    });

    it('пропорции читаются из inline-стиля, когда нет width/height', () => {
      const result = groupConsecutiveImages('<p><img src="test.jpg" style="aspect-ratio: 3 / 2"></p>');
      expect(result).toContain('img-single-wide');
    });
  });

  describe('removeImageLayoutClasses', () => {
    it('снимает обёртку img-row-2', () => {
      const html = '<div class="img-row-2"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-row-2');
      expect(result).toContain('<p><img src="1.jpg"></p>');
    });

    it('снимает обёртку img-grid', () => {
      const html = '<div class="img-grid"><p><img src="1.jpg"></p></div>';
      expect(removeImageLayoutClasses(html)).not.toContain('img-grid');
    });

    // Разметка эпохи aspect-sum: без снятия описание навсегда осталось бы в той раскладке.
    it('снимает обёртку img-jrow предыдущего поколения алгоритма', () => {
      const html = '<div class="img-jrow jrow-ar-150"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-jrow');
      expect(result).not.toContain('jrow-ar-');
      expect(result).toContain('<p><img src="1.jpg"></p>');
    });

    it('снимает классы обтекания с абзацев', () => {
      const html = '<p class="img-float-right figure-portrait"><img src="test.jpg"></p>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-float-right');
      expect(result).not.toContain('figure-portrait');
      expect(result).toContain('<img src="test.jpg">');
    });

    it('снимает класс single-wide с абзацев', () => {
      const html = '<p class="img-single-wide figure-landscape"><img src="test.jpg"></p>';
      const result = removeImageLayoutClasses(html);
      expect(result).not.toContain('img-single-wide');
      expect(result).not.toContain('figure-landscape');
    });
  });

  describe('applySmartImageLayout', () => {
    it('сохраняет явно назначенную сторону одиночного фото', () => {
      const html = '<p class="img-float-left figure-portrait"><img src="left.jpg" width="600" height="900"></p>';
      const result = applySmartImageLayout(html);

      expect(result).toContain('img-float-left');
      expect(result).not.toContain('img-float-right');
    });

    it('продолжает чередование с противоположной стороны после явно назначенного float', () => {
      const html =
        '<p class="img-float-left figure-portrait"><img src="left.jpg" width="600" height="900"></p>' +
        '<p>Разделитель.</p>' +
        '<p><img src="auto.jpg" width="600" height="900"></p>';
      const result = applySmartImageLayout(html);

      expect(result).toMatch(/left\.jpg[\s\S]*?img-float-right[^>]*>[\s\S]*?auto\.jpg/);
    });

    it('не сохраняет одиночные image-layout классы на текстовом абзаце', () => {
      const result = applySmartImageLayout(
        '<p class="img-float-left figure-portrait">Обычный текст.</p>' +
        '<p class="img-single-wide figure-landscape"><strong>Ещё текст.</strong></p>'
      );

      expect(result).not.toContain('img-float-left');
      expect(result).not.toContain('img-single-wide');
      expect(result).not.toContain('figure-portrait');
      expect(result).not.toContain('figure-landscape');
    });

    it('снимает одиночные float-классы, когда фото снова собираются в группу', () => {
      const html =
        '<p class="img-float-left figure-portrait"><img src="1.jpg" width="600" height="900"></p>' +
        '<p class="img-float-right figure-portrait"><img src="2.jpg" width="600" height="900"></p>';
      const result = applySmartImageLayout(html);

      expect(result).toContain('img-pair-portraits');
      expect(result).not.toContain('img-float-left');
      expect(result).not.toContain('img-float-right');
    });

    it('перекладывает разметку эпохи img-jrow на журнальную без вложенности', () => {
      const html = '<p>До</p><div class="img-jrow jrow-ar-225">' +
        '<p><img src="1.jpg" width="600" height="900"></p>' +
        '<p><img src="2.jpg" width="600" height="900"></p>' +
        '</div><p>После</p>';
      const result = applySmartImageLayout(html);
      expect(result).not.toContain('img-jrow');
      expect(result).toContain('img-pair-portraits');
      expect(result.match(/img-pair-portraits/g)?.length).toBe(1);
    });

    it('чистит и переприменяет без вложенности', () => {
      const html = '<p>До</p><div class="img-pair-portraits img-row-2 img-row-2-portrait">' +
        '<div class="img-pair-portraits img-row-2 img-row-2-portrait">' +
        '<p><img src="1.jpg" width="600" height="900"></p><p><img src="2.jpg" width="600" height="900"></p>' +
        '</div></div><p>После</p>';
      const result = applySmartImageLayout(html);
      expect(result.match(/img-row-2"|img-row-2 /g)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(result.match(/img-pair-portraits/g)?.length).toBe(1);
    });

    it('не падает на null/undefined', () => {
      expect(applySmartImageLayout(null as unknown as string)).toBe('');
      expect(applySmartImageLayout(undefined as unknown as string)).toBe('');
    });

    // Load-bearing (travel/672 phantom draft): каждый сейв прогоняет описание через
    // applySmartImageLayout. Не идемпотентный трансформ дрейфует HTML при каждом
    // прогоне, и перезаписанный после сейва черновик перестаёт быть смыслово
    // равным серверному описанию — всплывает ложный диалог восстановления.
    // Трансформ ОБЯЗАН быть идемпотентным.
    it('идемпотентен — повторный проход даёт тот же HTML (без дрейфа пробелов)', () => {
      const cases = [
        '<p>Intro.</p><p class="img-float-right figure-portrait"><img src="https://metravel.by/address-image/1/c.webp"></p><p>Outro.</p>',
        '<p class="figure-portrait">plain</p>',
        '<div class="img-row-2"><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>',
        '<div class="img-jrow jrow-ar-225"><p><img src="1.jpg" width="600" height="800"></p><p><img src="2.jpg" width="1200" height="800"></p></div>',
        '<p data-block="a" class="img-single-wide figure-landscape">x</p>',
        `<p>Т</p>${portrait('1.jpg')}${portrait('2.jpg')}${portrait('3.jpg')}${portrait('4.jpg')}<p>Т</p>`,
        `<p>Т</p>${landscape('1.jpg')}${portrait('2.jpg')}${landscape('3.jpg')}<p>Т</p>`,
        `<p>Т</p>${landscape('1.jpg')}${landscape('2.jpg')}${portrait('3.jpg')}${portrait('4.jpg')}<p>Т</p>`,
      ];
      for (const html of cases) {
        const once = applySmartImageLayout(html);
        const twice = applySmartImageLayout(once);
        expect(twice).toBe(once);
        expect(once).not.toMatch(/<p {2,}/);
      }
    });
  });

  // Веб и книга обязаны раскладывать одну группу одинаково. Именно этот паритет
  // и потерялся, когда раскладка перешла на классы `jrow-ar-*`: PDF-парсер их не
  // знал, и КАЖДАЯ группа падала в `grid-default`.
  describe('паритет с PDF-экспортом', () => {
    const groups: Array<{ name: string; html: string }> = [
      { name: 'два портрета', html: `${portrait('1.jpg')}${portrait('2.jpg')}` },
      { name: 'два ландшафта', html: `${landscape('1.jpg')}${landscape('2.jpg')}` },
      { name: 'портрет + ландшафт', html: `${portrait('1.jpg')}${landscape('2.jpg')}` },
      { name: 'два квадрата', html: `${square('1.jpg')}${square('2.jpg')}` },
      { name: 'триптих портретов', html: `${portrait('1.jpg')}${portrait('2.jpg')}${portrait('3.jpg')}` },
      {
        name: 'квартет портретов',
        html: `${portrait('1.jpg')}${portrait('2.jpg')}${portrait('3.jpg')}${portrait('4.jpg')}`,
      },
      {
        name: 'лоскут из четырёх ландшафтов',
        html: `${landscape('1.jpg')}${landscape('2.jpg')}${landscape('3.jpg')}${landscape('4.jpg')}`,
      },
      {
        name: 'сбалансированная сетка 2+2',
        html: `${landscape('1.jpg')}${landscape('2.jpg')}${portrait('3.jpg')}${portrait('4.jpg')}`,
      },
    ];

    it.each(groups)('«$name» распознаётся книгой, а не падает в grid-default', ({ html }) => {
      const laidOut = applySmartImageLayout(`<p>Т</p>${html}<p>Т</p>`);
      const blocks = new ContentParser().parse(laidOut);
      const gallery = blocks.find((block) => block.type === 'image-gallery');

      expect(gallery).toBeDefined();
      expect((gallery as { layout: string }).layout).not.toBe('grid-default');
    });
  });
});
