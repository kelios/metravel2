import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {i18n,getFixedTranslator} from '@/i18n';
import {formatReadyBookCounts,useBookCopy} from '@/components/books/bookCopy';

function Copy(){const t=useBookCopy();return <span>{t('download')}</span>;}
function EditionCopy(){
  const t=useBookCopy();
  return <><span data-testid="metadata-loading">{t('metadataLoading')}</span><span data-testid="metadata-error">{t('metadataError')}</span><span data-testid="quest-counts">{t('questCounts',{volume:'1',quests:'41',pages:'174'})}</span><span data-testid="quest-photo-space">{t('questPhotoSpace')}</span></>;
}
function CountCopy(){
  const t=useBookCopy();
  return <><span data-testid="place-counts">{formatReadyBookCounts({kind:'places',stopCount:12345,bodyPageCount:67890},t)}</span><span data-testid="volume-counts">{formatReadyBookCounts({kind:'quests',stopCount:37,bodyPageCount:156,volume:2},t)}</span></>;
}
describe('book controls follow the active interface language',()=>{
  afterEach(async()=>{await act(async()=>{await i18n.changeLanguage('ru');});});
  it('updates an already mounted control without remounting the book',async()=>{
    await i18n.changeLanguage('ru');
    render(<Copy/>);
    expect(screen.getByText('Скачать')).toBeTruthy();
    await act(async()=>{await i18n.changeLanguage('en');});
    expect(screen.getByText('Download')).toBeTruthy();
  });
  it('renders metadata states and quest copy through the real mapping after each interface-language change',async()=>{
    await i18n.changeLanguage('ru');
    render(<EditionCopy/>);
    for(const locale of ['ru','be','uk','pl','en'] as const){
      await act(async()=>{await i18n.changeLanguage(locale);});
      const t=getFixedTranslator(locale);
      expect(screen.getByTestId('metadata-loading').textContent).toBe(t('books:metadataLoading'));
      expect(screen.getByTestId('metadata-error').textContent).toBe(t('books:metadataError'));
      expect(screen.getByTestId('quest-counts').textContent).toBe(t('books:questCounts',{volume:'1',quests:'41',pages:'174'}));
      expect(screen.getByTestId('quest-counts').textContent).toContain('41');
      expect(screen.getByTestId('quest-photo-space').textContent).toBe(t('books:questPhotoSpace'));
    }
  });
  it('keeps place and quest-volume counts distinct and reformats an already mounted summary on locale changes',async()=>{
    await i18n.changeLanguage('ru');
    render(<CountCopy/>);
    for(const locale of ['ru','be','uk','pl','en'] as const){
      await act(async()=>{await i18n.changeLanguage(locale);});
      const t=getFixedTranslator(locale),numbers=new Intl.NumberFormat(locale);
      expect(screen.getByTestId('place-counts').textContent).toBe(t('books:counts',{places:numbers.format(12345),pages:numbers.format(67890)}));
      expect(screen.getByTestId('volume-counts').textContent).toBe(t('books:questCounts',{quests:'37',pages:'156',volume:'2'}));
    }
  });
});

it.each(['ru','be','uk','pl','en'])('interpolates dynamic book counts and names files without release-audit wording in %s',locale=>{
  const t=getFixedTranslator(locale);
  const counts=t('books:counts',{places:'31',pages:'108'});
  expect(counts).toContain('31');
  expect(counts).toContain('108');
  expect(t('books:language')).not.toContain('12');
  // The books are final editions: public file names carry no trial/test wording (#2944).
  for(const key of ['books:shop','books:control','books:body','books:rings','books:sewn','books:guideGeneric']){
    expect(t(key)).not.toBe(key);
    expect(t(key)).not.toMatch(/пробн|тэст|тест|test|trial|próbn|ppi/i);
  }
  expect(t('books:kilobytes')).not.toBe('books:kilobytes');
});
