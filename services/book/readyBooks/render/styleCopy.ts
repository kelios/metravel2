import type {BookVisualStyle} from '../../../../data/travelBooks/schema/editorial';

/** Style changes only image wording, credits and type; the edition voice is in data/travelBooks/frame-copy.json. */
export type BookStyleCopy = {
  style: BookVisualStyle;
  /** Alt prefix for the place image and the cover image. */
  artAlt: string;
  coverAlt: string;
  creditsSource: string;
  creditsFont: string;
};

const WATERCOLOR: BookStyleCopy = {
  style: 'watercolor',
  artAlt: 'Акварель',
  coverAlt: 'Акварель места из книги',
  creditsSource: 'Иллюстрации созданы с помощью ИИ по фотографиям автора из путешествий, опубликованных на MeTravel.by.',
  creditsFont: 'Marck Script — Denis Masharov, SIL Open Font License 1.1.',
};

const PHOTO: BookStyleCopy = {
  style: 'photo',
  artAlt: 'Фотография',
  coverAlt: 'Фотографии места из книги',
  creditsSource: 'Фотографии сделаны автором путешествий, опубликованных на MeTravel.by, в описанных местах и напечатаны без изменения содержания.',
  creditsFont: 'Lora — The Lora Project Authors, SIL Open Font License 1.1. Эпиграф обложки — Marck Script, Denis Masharov, SIL OFL 1.1.',
};

const FANTASY: BookStyleCopy = {
  style: 'fantasy',
  artAlt: 'Фэнтези-иллюстрация',
  coverAlt: 'Фэнтези-иллюстрация места из книги',
  creditsSource: 'Иллюстрации созданы с помощью ИИ по фотографиям автора из путешествий, опубликованных на MeTravel.by. Художественная атмосфера не меняет фактические рассказы о местах.',
  creditsFont: 'Cormorant Garamond — The Cormorant Project Authors, SIL Open Font License 1.1. Эпиграф обложки — Marck Script, Denis Masharov, SIL OFL 1.1.',
};

const GRAPHIC: BookStyleCopy = {
  style: 'graphic',
  artAlt: 'Графическая иллюстрация',
  coverAlt: 'Графическая иллюстрация места из книги',
  creditsSource: 'Графические иллюстрации созданы с помощью ИИ по фотографиям автора из путешествий, опубликованных на MeTravel.by.',
  creditsFont: 'Noto Serif и Noto Sans — The Noto Project Authors, SIL Open Font License 1.1. Эпиграф обложки — Marck Script, Denis Masharov, SIL OFL 1.1.',
};

export function bookStyleCopy(style: BookVisualStyle | undefined): BookStyleCopy {
  switch (style ?? 'watercolor') {
    case 'watercolor': return WATERCOLOR;
    case 'photo': return PHOTO;
    case 'fantasy': return FANTASY;
    case 'graphic': return GRAPHIC;
    default: throw new Error(`Visual style has no approved edition yet: ${style}`);
  }
}
