import {useLocalSearchParams} from 'expo-router';
import ReadyBookDetails from '@/components/books/ReadyBookDetails';
import {readyBooks,findReadyBook} from '@/services/book/readyBooks/catalog';
import {routeMetadata} from '@/utils/seoRoutes/routeMetadata';
import {translate} from '@/i18n';
export default function BookRoute(){const {slug}=useLocalSearchParams<{slug:string}>();return <ReadyBookDetails key={slug} slug={slug}/>;}
export const generateStaticParams=()=>readyBooks.map(book=>({slug:book.slug}));
export const generateMetadata=(_request:unknown,{slug}:{slug:string})=>{const book=findReadyBook(slug);return routeMetadata({title:book?.title??translate('books:notFound'),description:translate('books:intro'),canonical:book?`/books/${book.slug}`:'/books',...(book?{image:book.coverUri,imageAlt:book.title}:{robots:'noindex, nofollow'})});};
