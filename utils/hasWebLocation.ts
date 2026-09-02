// RN объявляет `global.window = global` (react-native/Libraries/Core/setUpGlobals.js:17),
// поэтому `typeof window !== 'undefined'` истинно и на телефоне — гардом это НЕ является.
// Отличает платформы `window.location`: RN его не полифиллит вовсе, и обращение к
// `.protocol`/`.hostname`/`.origin` на native бросает TypeError.
//
// Проверяем форму объекта, а не `Platform.OS`, сознательно: модули-потребители
// (`utils/mediaUrl.ts`, `utils/travelMedia.ts`, `components/travel/gallery/utils.ts`)
// иначе тянут `react-native` в свой web-чанк и ломают бюджет eager-запросов
// (`guard:bundle-budget`) на страницах путешествия и плана поездки.
export const hasWebLocation = (): boolean =>
  typeof window !== 'undefined' && Boolean((window as { location?: unknown }).location);
