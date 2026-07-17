export type QuestPoiInfo = {
  isMuseum: boolean;
  openingHours?: string;
  ticketPrice?: string;
  website?: string;
};

export type QuestStep = {
  id: string;
  title: string;
  location: string;
  story: string;
  task: string;
  hint?: string;
  answer: (input: string) => boolean;
  /** Человекочитаемый ожидаемый ответ — для «страницы ведущего» в печатной версии. */
  answerDisplay?: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  image?: any;
  inputType?: 'number' | 'text';
  poiInfo?: QuestPoiInfo | null;
};

export type QuestCity = {
  name?: string;
  lat: number;
  lng: number;
  countryCode?: string;
};

export type QuestFinale = {
  text: string;
  video?: any;
  poster?: any;
};
