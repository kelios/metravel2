import {
  getGalleryEntryId,
  getGalleryEntryUrl,
  getGalleryEntryCaption,
  buildGalleryEntryMap,
  findMatchingGalleryEntry,
  mergeGalleryPreserveCurrentCaptions,
} from '@/utils/galleryEntryModel';

describe('galleryEntryModel — читатели полей', () => {
  it('getGalleryEntryId: id как строка, пустой/пробельный → null', () => {
    expect(getGalleryEntryId({ id: 42 })).toBe('42');
    // id не триммится в возврате — пустым считается только по trim.
    expect(getGalleryEntryId({ id: '  7 ' })).toBe('  7 ');
    expect(getGalleryEntryId({ id: '' })).toBeNull();
    expect(getGalleryEntryId({ id: '   ' })).toBeNull();
    expect(getGalleryEntryId({ id: null })).toBeNull();
    expect(getGalleryEntryId('http://x')).toBeNull();
    expect(getGalleryEntryId(null)).toBeNull();
  });

  it('getGalleryEntryUrl: строка триммится, объект.url читается', () => {
    expect(getGalleryEntryUrl('  http://a  ')).toBe('http://a');
    expect(getGalleryEntryUrl({ url: '  http://b  ' })).toBe('http://b');
    expect(getGalleryEntryUrl({ url: 123 as unknown as string })).toBe('');
    expect(getGalleryEntryUrl(null)).toBe('');
  });

  it('getGalleryEntryCaption: только строковая подпись', () => {
    expect(getGalleryEntryCaption({ caption: 'hi' })).toBe('hi');
    expect(getGalleryEntryCaption({ caption: 5 as unknown as string })).toBeUndefined();
    expect(getGalleryEntryCaption('str')).toBeUndefined();
  });
});

describe('galleryEntryModel — buildGalleryEntryMap / findMatchingGalleryEntry', () => {
  it('индексирует по id и url', () => {
    const gallery = [
      { id: '1', url: 'http://a', caption: 'A' },
      'http://b',
    ];
    const map = buildGalleryEntryMap(gallery);
    expect(map.byId.get('1')).toEqual(gallery[0]);
    expect(map.byUrl.get('http://a')).toEqual(gallery[0]);
    expect(map.byUrl.get('http://b')).toBe('http://b');
  });

  it('находит запись сперва по id, затем по url', () => {
    const map = buildGalleryEntryMap([{ id: '9', url: 'http://z' }]);
    expect(findMatchingGalleryEntry({ id: '9' }, map)).toEqual({ id: '9', url: 'http://z' });
    expect(findMatchingGalleryEntry({ url: 'http://z' }, map)).toEqual({ id: '9', url: 'http://z' });
    expect(findMatchingGalleryEntry({ id: 'x', url: 'y' }, map)).toBeUndefined();
  });

  it('нестроковые/пустые записи пропускаются', () => {
    const map = buildGalleryEntryMap([null, 3, { id: '', url: '' }]);
    expect(map.byId.size).toBe(0);
    expect(map.byUrl.size).toBe(0);
  });
});

describe('mergeGalleryPreserveCurrentCaptions', () => {
  it('не-массив сохранённой галереи возвращается как есть', () => {
    expect(mergeGalleryPreserveCurrentCaptions(null, [])).toBeNull();
  });

  it('применяет текущую подпись, когда сохранённая пуста', () => {
    const saved = [{ id: '1', url: 'http://a', caption: '' }];
    const current = [{ id: '1', url: 'http://a', caption: 'новая' }];
    const result = mergeGalleryPreserveCurrentCaptions(saved, current) as Array<Record<string, unknown>>;
    expect(result[0].caption).toBe('новая');
  });

  it('не перезаписывает непустую серверную подпись, если пользователь её не менял', () => {
    const saved = [{ id: '1', url: 'http://a', caption: 'сервер' }];
    const current = [{ id: '1', url: 'http://a', caption: 'клиент' }];
    const source = [{ id: '1', url: 'http://a', caption: 'клиент' }];
    const result = mergeGalleryPreserveCurrentCaptions(saved, current, source) as Array<Record<string, unknown>>;
    // savedCaption непуст, current не менялся относительно source, current не очищен → оставляем serverside.
    expect(result[0].caption).toBe('сервер');
  });

  it('обрезает подпись до 500 символов', () => {
    const long = 'x'.repeat(600);
    const saved = [{ id: '1', url: 'http://a', caption: '' }];
    const current = [{ id: '1', url: 'http://a', caption: long }];
    const result = mergeGalleryPreserveCurrentCaptions(saved, current) as Array<Record<string, unknown>>;
    expect((result[0].caption as string).length).toBe(500);
  });
});
