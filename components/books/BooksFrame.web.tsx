import React from 'react';
import {ScrollView} from 'react-native';
import {useThemedColors} from '@/hooks/useTheme';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import {buildCanonicalUrl} from '@/utils/seo';
import {webTouchScrollStyle} from '@/utils';
import {booksCss} from './booksStyles';
import {translate} from '@/i18n';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';
/** `heading={false}`: the page renders its own `h1` (the edition hero, #2948). */
export function BooksFrame({title,path,children,headingLang,robots,description,heading=true}:{title:string,path:string,children:React.ReactNode,headingLang?:string,robots?:string,description?:string,heading?:boolean}){
  useLocaleRevision();
  const colors=useThemedColors();
  return <ScrollView key={path} testID="ready-books-scroll" style={[webTouchScrollStyle,{backgroundColor:colors.background}]} contentContainerStyle={{flexGrow:1}}>
    <main className="ready-books" style={{color:colors.text,background:colors.background,width:'100%',boxSizing:'border-box',marginTop:0,marginBottom:0}}>
      <InstantSEO title={title} description={description??translate('books:intro')} canonical={buildCanonicalUrl(path)} robots={robots}/>
      <style>{booksCss}</style>{heading&&<h1 lang={headingLang}>{title}</h1>}{children}
    </main>
  </ScrollView>;
}
