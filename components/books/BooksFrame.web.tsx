import React from 'react';
import {useThemedColors} from '@/hooks/useTheme';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import {buildCanonicalUrl} from '@/utils/seo';
import {booksCss} from './booksStyles';
import {useBookCopy} from './bookCopy';
export function BooksFrame({title,path,children,headingLang,robots}:{title:string,path:string,children:React.ReactNode,headingLang?:string,robots?:string}){
  const bookT=useBookCopy();
  const colors=useThemedColors();
  return <main className="ready-books" style={{color:colors.text,background:colors.background}}>
    <InstantSEO title={title} description={bookT('intro')} canonical={buildCanonicalUrl(path)} robots={robots}/>
    <style>{booksCss}</style><h1 lang={headingLang}>{title}</h1>{children}
  </main>;
}
