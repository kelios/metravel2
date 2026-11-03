import React,{useCallback} from 'react';
import Feather from '@expo/vector-icons/Feather';
import {useRouter,type Href} from 'expo-router';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** Decorative Feather glyph: hidden from the accessible name, coloured by the surrounding text. */
export function EditionIcon({name,size=20}:{name:FeatherName;size?:number}){
  return <span className="rbe-i" aria-hidden="true"><Feather name={name} size={size} color="currentColor"/></span>;
}

/**
 * Native disclosure: the browser owns the role, `expanded`, Enter/Space and works before
 * hydration. The summary carries text, not a heading (design doc, accessibility).
 */
export function EditionAccordion({icon,title,hint,titleId,children,className}:{icon?:FeatherName;title:string;hint?:string;titleId?:string;children:React.ReactNode;className?:string}){
  return <details className={['rbe-acc',className].filter(Boolean).join(' ')}>
    <summary>
      {icon&&<span className="rbe-acc-ic"><EditionIcon name={icon}/></span>}
      <span className="rbe-acc-txt"><span className="rbe-acc-title" id={titleId}>{title}</span>{hint&&<span className="rbe-acc-hint">{hint}</span>}</span>
      <span className="rbe-acc-chev"><EditionIcon name="chevron-down"/></span>
    </summary>
    <div className="rbe-acc-inner">{children}</div>
  </details>;
}

/** Plain `<a href>` that keeps client-side routing for an unmodified primary click. */
export function useEditionLink(){
  const router=useRouter();
  return useCallback((href:string)=>(event:React.MouseEvent<HTMLAnchorElement>)=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    router.push(href as Href);
  },[router]);
}
