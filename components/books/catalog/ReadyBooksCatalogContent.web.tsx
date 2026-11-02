import React, {useState} from 'react';
import {Link} from 'expo-router';
import {bookStyleKey,hasPrintSupplements} from '@/services/book/readyBooks/publicationState';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import {bookSeries,selectCatalogue,type CatalogueTheme} from '@/services/book/readyBooks/seriesCatalog';
import {formatNumber} from '@/i18n';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import {formatReadyBookCounts,useBookCopy} from '../bookCopy';
export default function ReadyBooksCatalogContent(){
  const bookT=useBookCopy();
  const [theme,setTheme]=useState<CatalogueTheme>('all');
  const {available,planned}=selectCatalogue(readyBooks,bookSeries,theme);
  const themes={all:'themeAll',mixed:'themeMixed',castles:'themeCastles',mountains:'themeMountains',quests:'themeQuests'} as const;
  return <>
    <fieldset className="ready-books-controls"><legend>{bookT('theme')}</legend>{(Object.keys(themes) as CatalogueTheme[]).map(value=><label key={value}><input type="radio" name="book-theme" value={value} checked={theme===value} onChange={()=>setTheme(value)}/>{bookT(themes[value])}</label>)}</fieldset>
    {available.length===0&&planned.length===0?<section><h2>{bookT(readyBooks.length===0?'preparing':'noBooks')}</h2><p>{bookT('pending')}</p></section>:<div className="ready-books-grid">{available.map(book=><article className="ready-books-card" key={book.id}>
      <ImageCardMedia src={book.coverUri} alt={book.title} height={280} fit="contain" webResponsiveSource={{src:book.coverUri}}/><div><h2 lang={book.contentLocale}>{book.title}</h2>{book.kind!=='quests'&&<p>{bookT('style')}: {bookT(bookStyleKey(book.visualStyle,'sourceContract' in book?book.sourceContract:undefined))}</p>}<p className="ready-books-note">{bookT(hasPrintSupplements(book)?'digitalKit':'partial')}</p><p>{bookT('language')}</p><p>{formatReadyBookCounts(book,bookT)}</p><p>{book.profiles.map(profile=><React.Fragment key={profile.id}>{bookT(profile.id==='album-a5'?'album':'pocket')}<br/></React.Fragment>)}</p><Link href={`/books/${book.slug}`}>{bookT('explore')}</Link></div>
    </article>)}{planned.map(series=><article className="ready-books-card" key={series.id}><div><h2 lang="ru">{series.title}</h2><p className="ready-books-note">{bookT('seriesPlanned')}</p><p>{bookT('seriesPlaces',{count:formatNumber(series.targetPlaces)})}</p><p>{bookT('language')}</p><p>{bookT('pending')}</p></div></article>)}</div>}
  </>;
}
