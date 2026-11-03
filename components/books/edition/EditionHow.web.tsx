import React,{useId} from 'react';
import {formatNumber} from '@/i18n';
import {useBookCopy} from '../bookCopy';

/** «Как устроена книга»: the real pages that follow the first place or quest in the selected size. */
export default function EditionHow({pages,quests,album}:{pages:{uri:string}[];quests:boolean;album:boolean}){
  const t=useBookCopy();
  const id=useId();
  const steps=[
    {title:t(quests?'howQuest':'howPlace'),text:t(quests?'howQuestText':'howPlaceText')},
    {title:t('howPhotos'),text:t(album?'howPhotosAlbum':'howPhotosPocket')},
    {title:t('howMemories'),text:t(quests?'howMemoriesQuestText':'howMemoriesText')},
  ];
  return <section className="rbe-block" aria-labelledby={id}>
    <h2 id={id}>{t('howTitle')}</h2>
    <p className="rbe-lead">{t(quests?'howLeadQuests':'howLead')}</p>
    <ol className="rbe-how">{steps.map((step,index)=><li key={step.title}>
      <div className="rbe-how-page" data-size={album?'a5':'pocket'}>{pages[index]&&<img src={pages[index].uri} alt="" loading="lazy" decoding="async"/>}</div>
      <div className="rbe-how-text"><h3><span className="rbe-step" aria-hidden="true">{formatNumber(index+1)}</span>{step.title}</h3><p>{step.text}</p></div>
    </li>)}</ol>
  </section>;
}
