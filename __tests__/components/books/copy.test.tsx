import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {i18n,getFixedTranslator} from '@/i18n';
import {useBookCopy} from '@/components/books/bookCopy';

function Copy(){const t=useBookCopy();return <span>{t('download')}</span>;}
describe('book controls follow the active interface language',()=>{
  afterEach(async()=>{await act(async()=>{await i18n.changeLanguage('ru');});});
  it('updates an already mounted control without remounting the book',async()=>{
    await i18n.changeLanguage('ru');
    render(<Copy/>);
    expect(screen.getByText('Скачать')).toBeTruthy();
    await act(async()=>{await i18n.changeLanguage('en');});
    expect(screen.getByText('Download')).toBeTruthy();
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
