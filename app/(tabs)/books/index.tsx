import ReadyBooksCatalog from '@/components/books/catalog/ReadyBooksCatalog';
import {routeMetadata} from '@/utils/seoRoutes/routeMetadata';
import {translate} from '@/i18n';
export default ReadyBooksCatalog;
export const generateMetadata=()=>routeMetadata({title:translate('books:title'),description:translate('books:intro'),canonical:'/books'});
