import React,{useEffect} from 'react';
import type {MiniDiary} from '@/data/travelBooks/schema/miniDiaries';
import {getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {BooksFrame} from './BooksFrame';
import {formatArtifactSize} from './bookArtifacts';
import {useBookCopy} from './bookCopy';
import {catalogCss,editionCss} from './booksStyles.web';
import {EditionIcon,scrollToAnchor,useEditionLink} from './edition/EditionParts.web';
import {pageCountPhrase} from './edition/editionModel';

export default function MiniDiaryDetails({diary}:{diary:MiniDiary}){
  const t=useBookCopy();
  const link=useEditionLink();
  const previewHref='#mini-diary-sample';
  useEffect(()=>{trackReadyBookEvent('ReadyBookViewed',diary,getActiveLocale());},[diary]);
  return <BooksFrame title={diary.title} path={`/books/${diary.slug}`} description={diary.summary} heading={false}>
    <div className="rbe">
      <style>{editionCss+catalogCss}</style>
      <section className="rbe-hero rbc-hero" aria-labelledby="mini-diary-title">
        <div className="rbc-hero-art">
          <div className="rbe-stage" data-size="a5"><div className="rbe-cover"><img src={diary.cover.uri} alt="" decoding="async"/></div></div>
        </div>
        <div className="rbc-hero-copy">
          <p className="rbe-eyebrow">{t('miniDiary')}</p>
          <h1 id="mini-diary-title" lang={diary.contentLocale}>{diary.title}</h1>
          <p className="rbe-promise" lang={diary.contentLocale}>{diary.summary}</p>
          <p className="rbe-small">{pageCountPhrase(diary.pageCount,t)} · A5 · {t('language')} · {formatArtifactSize(diary.pdf.bytes,t)}</p>
          <div className="rbe-cta">
            <a className="rbe-btn rbe-btn-primary" href={diary.pdf.uri} download={`${diary.title} — A5.pdf`}
              onClick={()=>trackReadyBookEvent('ReadyBookDownloadRequested',diary,getActiveLocale(),{profileId:'album-a5',artifactPurpose:'read'})}>
              <EditionIcon name="download"/>{t('miniDownload')}
            </a>
            <a className="rbe-btn rbe-btn-secondary" href={previewHref} onClick={event=>{
              scrollToAnchor(previewHref)(event);
              trackReadyBookEvent('ReadyBookPreviewOpened',diary,getActiveLocale(),{profileId:'album-a5'});
            }}><EditionIcon name="book-open"/>{t('miniPreview')}</a>
          </div>
        </div>
      </section>
      <section className="rbe-block" id="mini-diary-sample" tabIndex={-1} aria-labelledby="mini-diary-sample-title">
        <h2 id="mini-diary-sample-title">{t('miniPreview')}</h2>
        <div className="rbc-mini-preview">
          <img src={diary.preview.uri} alt={t('miniPreview')} width={420} height={595} loading="lazy" decoding="async"/>
        </div>
      </section>
      <section className="rbe-block" aria-labelledby="mini-diary-contents">
        <h2 id="mini-diary-contents">{t('contents')}</h2>
        <ol className="rbc-style-list">{diary.stops.map(stop=><li key={stop.mapUrl}>
          <a className="rbe-link" href={stop.mapUrl} lang={diary.contentLocale}><EditionIcon name="map-pin" size={16}/>{stop.title}</a>
        </li>)}</ol>
      </section>
      <p className="rbe-foot"><a className="rbe-link" href="/books" onClick={link('/books')}><EditionIcon name="arrow-left" size={16}/>{t('back')}</a></p>
    </div>
  </BooksFrame>;
}
