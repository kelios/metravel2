import React,{useCallback} from 'react';
import featherGlyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json';
import {useRouter,type Href} from 'expo-router';
import {ICON_FONT_ATTR,ICON_FONT_FAMILY} from '@/utils/iconFontContract';

type FeatherName = keyof typeof featherGlyphs;

/** Keep the glyph phrasing content so paragraphs survive HTML parsing before hydration. */
export function EditionIcon({name,size=20}:{name:FeatherName;size?:number}){
  return <span className="rbe-i" aria-hidden="true">
    <span {...{[ICON_FONT_ATTR]:ICON_FONT_FAMILY}} style={{fontFamily:ICON_FONT_FAMILY,fontSize:size,fontStyle:'normal',fontWeight:'normal',lineHeight:'normal',minWidth:size,minHeight:size,userSelect:'none'}}>
      {String.fromCodePoint(featherGlyphs[name])}
    </span>
  </span>;
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

/**
 * In-page `#anchor` link: scrolls the books scroll container (not the window) and moves focus
 * to the target section; motion follows `prefers-reduced-motion`.
 */
export function scrollToAnchor(href:string){
  return (event:React.MouseEvent<HTMLAnchorElement>)=>{
    const target=document.getElementById(href.slice(1));
    if(!target)return;
    event.preventDefault();
    const reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
    target.focus({preventScroll:true});
  };
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
