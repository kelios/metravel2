export type QuestStep = {
  id: string;
  title: string;
  location: string;
  story: string;
  task: string;
  hint?: string;
  answer: (input: string) => boolean;
  lat: number;
  lng: number;
  mapsUrl: string;
  image?: any;
  inputType?: 'number' | 'text';
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
