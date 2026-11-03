import React,{useId} from 'react';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import {bookStyleKey} from '@/services/book/readyBooks/publicationState';
import {useBookCopy} from '../bookCopy';
import {EditionIcon,useEditionLink} from './EditionParts.web';
import {isAlbumProfile,stopCountPhrase} from './editionModel';

const STYLE_HINT={styleWatercolor:'styleWatercolorHint',stylePhoto:'stylePhotoHint',stylePhotoSources:'stylePhotoSourcesHint',styleGraphic:'styleGraphicHint',styleFantasy:'styleFantasyHint'} as const;
type StyleEdition = Pick<ReadyBookSummary,'id'|'slug'|'visualStyle'|'coverUri'> & {sourceContract?:'thematic-v1'};

function StyleBody({book}:{book:StyleEdition}){
  const t=useBookCopy();
  const key=bookStyleKey(book.visualStyle,book.sourceContract);
  return <span className="rbe-opt-body"><span className="rbe-h3">{t(key)}</span><span className="rbe-small">{t(STYLE_HINT[key])}</span></span>;
}

/**
 * «Выберите свою». A style is another edition, so it is a link that keeps the chosen size
 * (`?profile=`); the current style is marked with `aria-current`, not a radio. The size is a
 * native radio group: role, checked state, arrow keys and roving focus come from the browser.
 */
export default function EditionChoose({book,profileId,currentCoverUri,otherStyles,onProfile,sectionId}:{
  book:PublishedBook;profileId:string;currentCoverUri?:string;otherStyles:readonly StyleEdition[];
  onProfile:(profileId:PublishedBook['profiles'][number]['id'])=>void;sectionId:string;
}){
  const t=useBookCopy();
  const id=useId();
  const link=useEditionLink();
  const hasStyles=otherStyles.length>0;
  return <section className="rbe-block" id={sectionId} tabIndex={-1} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{t('chooseTitle')}</h2>
    <p className="rbe-lead">{hasStyles?t('chooseLead',{places:stopCountPhrase(book,t)}):t('chooseLeadSize')}</p>
    {hasStyles&&<>
      <p className="rbe-label" id={`${id}-style`}>{t('style')}</p>
      <nav aria-labelledby={`${id}-style`}><ul className="rbe-styles">
        <li><div className="rbe-opt is-checked" aria-current="true">
          <span className="rbe-check"><EditionIcon name="check" size={16}/></span>
          <span className="rbe-opt-thumb">{currentCoverUri&&<img src={currentCoverUri} alt="" loading="lazy" decoding="async"/>}</span>
          <StyleBody book={book}/>
        </div></li>
        {otherStyles.map(other=>{
          const href=`/books/${other.slug}?profile=${profileId}`;
          return <li key={other.id}><a className="rbe-opt" href={href} onClick={link(href)}>
            <span className="rbe-opt-thumb"><img src={other.coverUri} alt="" loading="lazy" decoding="async"/></span>
            <StyleBody book={other}/>
          </a></li>;
        })}
      </ul></nav>
    </>}
    <fieldset className="rbe-sizes-group">
      <legend className="rbe-label">{t('size')}</legend>
      <div className="rbe-sizes">{book.profiles.map(profile=>{
        const album=isAlbumProfile(profile.id);
        const checked=profile.id===profileId;
        return <label key={profile.id} className={`rbe-opt rbe-size${checked?' is-checked':''}`}>
          <input type="radio" name={`${id}-size`} value={profile.id} checked={checked} aria-labelledby={`${id}-${profile.id}-title`} aria-describedby={`${id}-${profile.id}-hint`} onChange={()=>onProfile(profile.id)}/>
          <span className="rbe-check" aria-hidden="true"><EditionIcon name="check" size={16}/></span>
          <span className={`rbe-sil ${album?'rbe-sil-a5':'rbe-sil-pocket'}`} aria-hidden="true"><span className="rbe-sil-paper"><span className="rbe-sil-photo"/></span></span>
          <span className="rbe-opt-body"><span className="rbe-h3" id={`${id}-${profile.id}-title`}>{t(album?'sizeAlbumTitle':'sizePocketTitle')}</span><span className="rbe-small" id={`${id}-${profile.id}-hint`}>{t(album?'sizeAlbumHint':'sizePocketHint')}</span></span>
        </label>;
      })}</div>
    </fieldset>
  </section>;
}
