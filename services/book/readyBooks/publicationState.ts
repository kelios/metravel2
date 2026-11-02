import type {PublishedBook} from './publication';

/** A digital print kit can be complete while provider/paper approval is pending. */
export function hasPrintSupplements(book:Pick<PublishedBook,'missing'>):boolean{
  return !book.missing.some(purpose=>purpose==='stickers'||purpose==='instructions'||purpose==='print-passport');
}

import type {BookVisualStyle} from '../../../data/travelBooks/schema/editorial';

/** Editions without a style are the original watercolor series; every other published style names itself (#2854). */
const STYLE_KEYS:Record<BookVisualStyle,'styleWatercolor'|'stylePhoto'|'styleGraphic'|'styleFantasy'>={watercolor:'styleWatercolor',photo:'stylePhoto',graphic:'styleGraphic',fantasy:'styleFantasy'};
export const bookStyleKey=(style:BookVisualStyle|undefined,sourceContract?:'thematic-v1')=>
  sourceContract==='thematic-v1'&&style==='photo'?'stylePhotoSources':STYLE_KEYS[style??'watercolor'];
