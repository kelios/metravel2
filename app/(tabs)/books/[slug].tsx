import {useLocalSearchParams} from 'expo-router';
import ReadyBookDetails from '@/components/books/ReadyBookDetails';
import MiniDiaryDetails from '@/components/books/MiniDiaryDetails';
import {readyBooks,findReadyBook,miniDiaries,findMiniDiary} from '@/services/book/readyBooks/catalog';
import {readyBookEntrySource} from '@/services/book/readyBooks/related';
import {routeMetadata} from '@/utils/seoRoutes/routeMetadata';
import {translate} from '@/i18n';
import {bookT} from '@/components/books/bookCopy';
import {readyBookDescription} from '@/components/books/bookArtifacts';
export default function BookRoute(){
  const {slug,profile,from}=useLocalSearchParams<{slug:string;profile?:string;from?:string}>();
  const diary=findMiniDiary(slug);
  return diary
    ? <MiniDiaryDetails key={slug} diary={diary}/>
    : <ReadyBookDetails key={slug} slug={slug} initialProfileId={profile} entrySource={readyBookEntrySource(from)}/>;
}

export const generateStaticParams=()=>[...readyBooks,...miniDiaries].map(book=>({slug:book.slug}));

export const generateMetadata=(_request:unknown,{slug}:{slug:string})=>{
  const diary=findMiniDiary(slug);
  if(diary)return routeMetadata({title:diary.title,description:diary.summary,canonical:`/books/${diary.slug}`,image:diary.cover.uri,imageAlt:diary.title});
  const book=findReadyBook(slug);
  return routeMetadata({title:book?.title??translate('books:notFound'),description:book?readyBookDescription(book,bookT):translate('books:intro'),canonical:book?`/books/${book.slug}`:'/books',...(book?{image:book.coverUri,imageAlt:book.title}:{robots:'noindex, nofollow'})});
};
