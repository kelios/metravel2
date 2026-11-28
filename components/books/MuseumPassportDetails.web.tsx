import React,{useEffect} from 'react';
import type {MuseumPassport} from '@/data/travelBooks/schema/museumPassports';
import {formatNumber,getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {BooksFrame} from './BooksFrame';
import {formatArtifactSize} from './bookArtifacts';
import {useBookCopy} from './bookCopy';
import {catalogCss,editionCss} from './booksStyles.web';
import {EditionAccordion,EditionIcon,scrollToAnchor,useEditionLink} from './edition/EditionParts.web';
import {pageCountPhrase} from './edition/editionModel';

const files=[['read','museumRead','museumReadHint'],['booklet','museumBooklet','museumBookletHint'],['wrapCover','museumWrap','museumWrapHint'],['stickers','museumStickers','museumStickersHint']] as const;

export default function MuseumPassportDetails({passport}:{passport:MuseumPassport}){
  const t=useBookCopy(),link=useEditionLink();
  const contents=(museums:MuseumPassport['museums'])=>museums.map(museum=><li key={museum.number}>
    <span className="rbe-route-n">{formatNumber(museum.number)}</span>
    <a className="rbe-route-t rbe-link" href={`${passport.read.uri}#page=${museum.page}`} onClick={previewOpened} lang="pl">{museum.title}</a>
    <span className="rbe-route-p">{t('routePage',{page:formatNumber(museum.page)})}</span>
  </li>);
  const previewOpened=()=>trackReadyBookEvent('ReadyBookPreviewOpened',passport,getActiveLocale());
  const download=(key:typeof files[number][0])=>trackReadyBookEvent('ReadyBookDownloadRequested',passport,getActiveLocale(),{artifactPurpose:key,artifactComponent:key==='stickers'?'stickers':key==='wrapCover'?'cover':'body'});
  useEffect(()=>{trackReadyBookEvent('ReadyBookViewed',passport,getActiveLocale());},[passport]);
  return <BooksFrame title={passport.title} path={`/books/${passport.slug}`} description={passport.summary} heading={false}>
    <div className="rbe rmd">
      <style>{editionCss+catalogCss}</style>
      <section className="rbe-hero rbc-hero" aria-labelledby="museum-passport-title">
        <div className="rbc-hero-art rmd-hero-art">
          <img src={passport.cover.uri} alt={t('coverAlt',{title:passport.title})} width={420} height={594} decoding="async"/>
          <img src={passport.preview.uri} alt={t('museumPreviewAlt')} width={420} height={594} decoding="async"/>
        </div>
        <div className="rbc-hero-copy">
          <p className="rbe-eyebrow">{t('museumPassport')}</p>
          <h1 id="museum-passport-title" lang={passport.contentLocale}>{passport.title}</h1>
          <p className="rbe-promise" lang={passport.contentLocale}>{passport.summary}</p>
          <ul className="rbe-chips">
            <li>{t('museumCount',{count:formatNumber(passport.museumCount)})}</li>
            <li>{pageCountPhrase(passport.logicalPageCount,t)} · A4</li>
            <li>{t('chipFree')}</li><li>{t('language')}</li><li>{t('chipNoSignup')}</li>
          </ul>
          <div className="rbe-cta">
            <a className="rbe-btn rbe-btn-primary" href="#museum-passport-downloads" onClick={scrollToAnchor('#museum-passport-downloads')}><EditionIcon name="download"/>{t('museumFiles')}</a>
            <a className="rbe-btn rbe-btn-secondary" href={passport.read.uri} onClick={previewOpened}><EditionIcon name="book-open"/>{t('museumRead')}</a>
          </div>
        </div>
      </section>
      <section className="rbe-block" id="museum-passport-downloads" tabIndex={-1} aria-labelledby="museum-files-title">
        <h2 id="museum-files-title">{t('museumFiles')}</h2>
        <p className="rbe-lead">{t('museumFilesLead')}</p>
        <ul className="rbe-paths">{files.map(([key,title,hint])=><li className="rbe-path" key={key}>
          <h3>{t(title)}</h3><p>{t(hint)}</p>
          <a className="rbe-btn rbe-btn-secondary" href={passport[key].uri} download={`${passport.slug}-${key}.pdf`} onClick={()=>download(key)}>
            <EditionIcon name="download"/>{t('download')} · {formatArtifactSize(passport[key].bytes,t)}<span className="rbe-sr"> · {t(title)}</span>
          </a>
        </li>)}</ul>
        <p className="rbe-small rmd-print-note">{t('printNotCertified')} {t('museumResolution',{ppi:formatNumber(Math.floor(passport.quality.minIllustrationPpi))})}</p>
      </section>
      <section className="rbe-block" aria-labelledby="museum-contents-title">
        <h2 id="museum-contents-title">{t('contents')}</h2>
        <p className="rbe-lead">{t('museumAccessNote')}</p>
        <ol className="rbe-route">{contents(passport.museums.slice(0,12))}</ol>
        {passport.museums.length>12&&<EditionAccordion title={t('museumShowAll',{count:formatNumber(passport.museumCount)})}>
          <ol className="rbe-route" start={13}>{contents(passport.museums.slice(12))}</ol>
        </EditionAccordion>}
      </section>
      <p className="rbe-foot"><a className="rbe-link" href="/books" onClick={link('/books')}><EditionIcon name="arrow-left" size={16}/>{t('back')}</a></p>
    </div>
  </BooksFrame>;
}
