const { loadPatterns, scanText } = require('../../scripts/scan-content-sources.js');

describe('scan-content-sources', () => {
  const patterns = loadPatterns();
  const ids = (text: string) => scanText(text, patterns).map((h: { id: string }) => h.id);

  it('ловит запрещённые источники по названию и домену', () => {
    expect(ids('по данным «Наша Ніва» замок строили…')).toEqual(['nasha-niva']);
    expect(ids('источник: https://nashaniva.com/123')).toEqual(['nasha-niva']);
    expect(ids('как писало «Зеркало»')).toEqual(['zerkalo']);
    expect(ids('ссылка на news.zerkalo.io')).toEqual(['zerkalo']);
    expect(ids('статья TUT.BY 2019 года')).toEqual(['zerkalo']);
    expect(ids('рассказ Радыё Свабода')).toEqual(['svaboda']);
    expect(ids('сюжет Белсат')).toEqual(['belsat']);
    expect(ids('Хартия\'97 сообщала')).toEqual(['charter97']);
  });

  it('не ловит бытовые слова', () => {
    expect(ids('в зале висит старинное зеркало')).toEqual([]);
    expect(ids('зеркальная гладь озера, свобода и простор')).toEqual([]);
    expect(ids('наш край богат озёрами')).toEqual([]);
    expect(ids('новый час работы музея')).toEqual([]);
  });

  it('возвращает номер строки', () => {
    const hits = scanText('строка один\nисточник Белсат', patterns, 'f.md');
    expect(hits).toEqual([expect.objectContaining({ source: 'f.md', line: 2, id: 'belsat' })]);
  });
});
