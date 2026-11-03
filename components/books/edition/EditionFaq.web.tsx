import React,{useId} from 'react';
import {useBookCopy} from '../bookCopy';
import {EditionIcon} from './EditionParts.web';

// Owner decision 02.11.2026: five questions; the gifting/selling answer is not published.
const QUESTIONS=[
  ['faqFreeQ','faqFreeA'],['faqSignupQ','faqSignupA'],['faqPaperQ','faqPaperA'],['faqPhotosQ','faqPhotosA'],['faqLanguageQ','faqLanguageA'],
] as const;

export default function EditionFaq(){
  const t=useBookCopy();
  const id=useId();
  return <section className="rbe-block rbe-faq" aria-labelledby={id}>
    <h2 id={id}>{t('faqTitle')}</h2>
    {QUESTIONS.map(([question,answer])=><details key={question} className="rbe-acc">
      <summary><span className="rbe-acc-title">{t(question)}</span><span className="rbe-acc-chev"><EditionIcon name="chevron-down"/></span></summary>
      <div className="rbe-acc-inner"><p>{t(answer)}</p></div>
    </details>)}
  </section>;
}
