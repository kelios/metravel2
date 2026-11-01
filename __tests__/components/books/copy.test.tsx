import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {i18n,getFixedTranslator} from '@/i18n';
import {useBookCopy} from '@/components/books/bookCopy';

function Copy(){const t=useBookCopy();return <span>{t('download')}</span>;}
function EditionCopy(){
  const t=useBookCopy();
  return <><span data-testid="metadata-loading">{t('metadataLoading')}</span><span data-testid="metadata-error">{t('metadataError')}</span><span data-testid="quest-counts">{t('questCounts',{volume:'1',quests:'41',pages:'174'})}</span><span data-testid="quest-photo-space">{t('questPhotoSpace')}</span></>;
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
});

it.each(['ru','be','uk','pl','en'])('interpolates dynamic book counts and honest proof status in %s',locale=>{
  const t=getFixedTranslator(locale);
  const counts=t('books:counts',{places:'31',pages:'108'});
  expect(counts).toContain('31');
  expect(counts).toContain('108');
  expect(t('books:language')).not.toContain('12');
  expect(t('books:proofOnly')).not.toBe('books:proofOnly');
  expect(t('books:illustrationPpi',{ppi:'181'})).toContain('181');
});
