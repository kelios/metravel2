import React,{useId,useState} from 'react';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';
import {translate,getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';
import {assertBookPrintResource,bookPrintGuidePage} from '@/services/book/readyBooks/printResources';
import type {PublishedBook,PublishedArtifact} from '@/services/book/readyBooks/publication';
import {useBookCopy} from '../bookCopy';

const icon=(name:React.ComponentProps<typeof Feather>['name'],size=20)=><span className="rbe-i" aria-hidden="true"><Feather name={name} size={size} color="currentColor"/></span>;

// Keys go through the literal-key map in bookCopy.ts, which the web build inlines.
const PATHS=[
  {icon:'home',title:'pathHome',text:'pathHomeText',files:'pathHomeFiles',steps:['pathStepHome1','pathStepHome2','pathStepHome3']},
  {icon:'copy',title:'pathCopy',text:'pathCopyText',files:'pathCopyFiles',steps:['pathStepCopy1','pathStepCopy2','pathStepCopy3']},
  {icon:'briefcase',title:'pathPress',text:'pathPressText',files:'pathCopyFiles',steps:['pathStepPress1','pathStepPress2','pathStepPress3']},
] as const;

/**
 * «Как напечатать»: three ways to print with their steps behind «Подробнее», then the full
 * HTML guide of the selected size (#2805). `children` is the «Где напечатать» disclosure.
 */
export default function PrintingGuide({book,profileId,children}:{book:PublishedBook;profileId:PublishedArtifact['profileId'];children?:React.ReactNode}){
  const t=useBookCopy();
  const id=useId();
  const [failedUri,setFailed]=useState<string|null>(null);
  const page=bookPrintGuidePage(book,profileId);
  const file=page??book.artifacts.find(file=>file.profileId===profileId&&file.purpose==='instructions');
  const failed=!!file&&failedUri===file.uri;
  const open=async()=>{
    setFailed(null);
    try{
      if(!file)throw new Error('BOOK_PRINT_GUIDE_UNAVAILABLE');
      assertBookPrintResource(book,file);
      if(!await openExternalUrlInNewTab(file.uri))setFailed(file?.uri??null);
      else trackReadyBookEvent('ReadyBookInstructionsViewed',book,getActiveLocale(),{profileId});
    }catch{setFailed(file?.uri??null);}
  };
  return <section className="rbe-block" aria-labelledby={id}>
    <h2 id={id}>{translate('books:guideTitle')}</h2>
    <p className="rbe-lead">{t('guideLead')}</p>
    <ul className="rbe-paths">{PATHS.map(path=><li key={path.icon} className="rbe-path">
      <span className="rbe-path-ic">{icon(path.icon)}</span>
      <h3>{t(path.title)}</h3><p>{t(path.text)}</p><p className="rbe-path-fit">{t(path.files)}</p>
      <details><summary>{t('pathMore')}<span className="rbe-sr">: {t(path.title)}</span>{icon('chevron-down',16)}</summary><ol>{path.steps.map(step=><li key={step}>{t(step)}</li>)}</ol></details>
    </li>)}</ul>
    <div className="rbe-guide-open">
      {file?<Button variant="ghost" icon={icon('file-text',16)} label={failed?translate('books:retry'):page?translate('books:guideOpen'):`${translate('books:instructions')} · PDF`} onPress={()=>void open()}/>:<p>{translate('books:guideGeneric')}</p>}
      {failed&&<p role="alert">{translate('books:pageError')}</p>}
    </div>
    {children}
  </section>;
}
