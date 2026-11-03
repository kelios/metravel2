import React,{useId} from 'react';
import {useBookCopy} from '../bookCopy';
import {EditionIcon,scrollToAnchor} from './EditionParts.web';

type Chip = {icon:React.ComponentProps<typeof EditionIcon>['name'];label:string;accent?:boolean};
export type EditionHeroProps = {
  title:string;contentLocale:string;promise:string;chips:Chip[];
  coverUri?:string;coverAlt:string;spreads:{uri:string}[][];album:boolean;caption:string;meta:string;
  /** Absent until book.json is verified: the buttons stay visible but disabled (design doc, states). */
  download?:{href:string;filename:string;onClick:()=>void};
  onRead?:()=>void;
  readRef?:React.Ref<HTMLButtonElement>;
  ctaRef?:React.Ref<HTMLDivElement>;
  chooseHref?:string;
};

export default function EditionHero({title,contentLocale,promise,chips,coverUri,coverAlt,spreads,album,caption,meta,download,onRead,readRef,ctaRef,chooseHref}:EditionHeroProps){
  const t=useBookCopy();
  const titleId=useId();
  // Two spread slots are always reserved so the verified pages do not shift the hero.
  const slots=[spreads[0]??[],spreads[1]??[]];
  return <section className="rbe-hero" aria-labelledby={titleId}>
    <div>
      <div className="rbe-stage" data-size={album?'a5':'pocket'}>
        {slots.map((pages,index)=><div key={index} className={`rbe-spread rbe-spread-${index+1}`} aria-hidden="true">
          {pages.map(page=><img key={page.uri} src={page.uri} alt="" loading="lazy" decoding="async"/>)}
        </div>)}
        <div className="rbe-cover">{coverUri&&<img src={coverUri} alt={coverAlt} decoding="async"/>}</div>
      </div>
      <p className="rbe-small rbe-stage-caption">{caption}</p>
    </div>
    <div>
      <p className="rbe-eyebrow">{t('heroEyebrow')}</p>
      <h1 id={titleId} lang={contentLocale}>{title}</h1>
      <p className="rbe-promise">{promise}</p>
      <ul className="rbe-chips" aria-label={t('chipsLabel')}>
        {chips.map(chip=><li key={chip.label} className={chip.accent?'is-accent':undefined}><EditionIcon name={chip.icon} size={16}/>{chip.label}</li>)}
      </ul>
      <div className="rbe-cta" ref={ctaRef}>
        {download
          ?<a className="rbe-btn rbe-btn-primary" href={download.href} download={download.filename} onClick={download.onClick}><EditionIcon name="download"/>{t('ctaDownload')}</a>
          :<button type="button" className="rbe-btn rbe-btn-primary" disabled><EditionIcon name="download"/>{t('ctaDownload')}</button>}
        <button type="button" ref={readRef} className="rbe-btn rbe-btn-secondary" disabled={!onRead} onClick={onRead}><EditionIcon name="book-open"/>{t('ctaRead')}</button>
      </div>
      <div className="rbe-cta-meta rbe-small">
        <span>{meta}</span>
        {chooseHref&&<a className="rbe-link" href={chooseHref} onClick={scrollToAnchor(chooseHref)}>{t('ctaOtherOptions')}<EditionIcon name="chevron-down" size={16}/></a>}
      </div>
    </div>
  </section>;
}
