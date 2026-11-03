import React from 'react';
import {useBookCopy} from '../bookCopy';
import {EditionIcon} from './EditionParts.web';

/**
 * Mobile quick actions (<800 px). `position: sticky` inside the after-hero block shows it only once that
 * block reaches the screen, without a scroll observer. It never takes focus; a scroll padding keeps focused
 * content clear of it. Its controls keep their short visible names inside the named region, so they
 * never duplicate the hero's «Скачать книгу» / «Листать книгу» link names (#2951).
 */
export default function EditionStickyBar({download,onRead}:{download:{href:string;filename:string;onClick:()=>void};onRead:()=>void}){
  const t=useBookCopy();
  return <div className="rbe-sticky" role="region" aria-label={t('stickyLabel')}>
    <a className="rbe-btn rbe-btn-primary" href={download.href} download={download.filename} onClick={download.onClick}><EditionIcon name="download"/>{t('stickyDownload')}</a>
    <button type="button" className="rbe-btn rbe-btn-secondary" onClick={onRead}><EditionIcon name="book-open"/>{t('stickyRead')}</button>
  </div>;
}
