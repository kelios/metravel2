import type {BookVisualStyle} from '../../../../data/travelBooks/schema/editorial';

/** Style changes only wording and type; page geometry, QR, map and cover stay shared. */
export type BookStyleCopy = {
  style: BookVisualStyle;
  /** Alt prefix for the place image and the cover image. */
  artAlt: string;
  coverAlt: string;
  usage: string;
  creditsSource: string;
  creditsFont: string;
};

const WATERCOLOR: BookStyleCopy = {
  style: 'watercolor',
  artAlt: 'Акварель',
  coverAlt: 'Акварель места из книги',
  usage: 'У каждого места три страницы: акварель и короткий рассказ, свободное место для собственного снимка и чистая страница для записей.',
  creditsSource: 'Основой акварелей стали фотографии автора опубликованных путешествий MeTravel. Источники и происхождение производных изображений сохранены в реестре издания.',
  creditsFont: 'Marck Script — Denis Masharov, SIL Open Font License 1.1. Русский язык.',
};

const PHOTO: BookStyleCopy = {
  style: 'photo',
  artAlt: 'Фотография',
  coverAlt: 'Фотографии места из книги',
  usage: 'У каждого места три страницы: фотографии автора и короткий рассказ, свободное место для собственного снимка и чистая страница для записей.',
  creditsSource: 'Фотографии сделаны автором опубликованных путешествий MeTravel в описанных местах и напечатаны без изменения содержания. Источники каждого снимка сохранены в реестре издания.',
  creditsFont: 'Lora — The Lora Project Authors, SIL Open Font License 1.1. Эпиграф обложки — Marck Script, Denis Masharov, SIL OFL 1.1. Русский язык.',
};

export function bookStyleCopy(style: BookVisualStyle | undefined): BookStyleCopy {
  switch (style ?? 'watercolor') {
    case 'watercolor': return WATERCOLOR;
    case 'photo': return PHOTO;
    default: throw new Error(`Visual style has no approved edition yet: ${style}`);
  }
}
