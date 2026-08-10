// utils/travelDisplayLocation.ts
// Приведение `travel.cityName` к пригодному для показа виду.
//
// Бэкенд кладёт в `cityName` не город, а подпись первой точки маршрута из
// обратного геокодинга: «Базилика Святого Стефана, 1, Szent István tér,
// Lipótváros, 5th district, Будапешт, ..., 1051, Венгрия», «Parking Zamkowy ·
// Wałowa · Мальборк · Поморское воеводство · Польша», «Замок Болчув». В выборке
// из 60 записей прод-API настоящего названия города не оказалось ни разу.
// Карточка в избранном и запись в истории просмотров рендерят это поле в одну
// строку с `numberOfLines={1}`, поэтому пользователь видел обрезанный адрес.
//
// Сырое значение при этом править нельзя: `utils/questForLocation.ts` матчит
// квест подстрокой именно по нему. Поэтому здесь только display-слой — он
// отсекает адресоподобные значения, а вызывающий код показывает страну.

/** Разделители, которыми геокодер сшивает уровни адреса. */
const ADDRESS_SEPARATORS = /[,·;|/(){}[\]"«»—–:]/;

/**
 * Слова, по которым видно, что это объект или административная единица, а не
 * город: «Замок Болчув», «Верхний город и площадь Свободы», «Улица Советская».
 * Сверяем по началу слова, а не подстрокой по всей строке, иначе «Загора»
 * попадёт под маркер «гора», а «Белоозерск» — под «озеро».
 */
const NON_CITY_WORD_PREFIXES = [
    'улиц', 'площад', 'проспект', 'переул', 'шоссе', 'дорог', 'трасс',
    'район', 'област', 'воеводств', 'повят', 'сельсовет', 'гмина',
    'замок', 'замк', 'дворец', 'усадьб', 'музей', 'заповедник', 'заказник',
    'озеро', 'река', 'гора', 'водопад', 'пещер', 'приют', 'стоянк', 'кемпинг',
    'street', 'road', 'avenue', 'square', 'district', 'region', 'county',
    'castle', 'palace', 'museum', 'lake', 'river', 'mount', 'strada',
    'via', 'ulica', 'utca', 'gmina', 'rue',
];

/** Одиночный топоним редко длиннее этого: «Петропавловск-Камчатский» — 24 символа. */
const MAX_CITY_LENGTH = 32;

/** Составные названия («Нижний Новгород», «Франкфурт-на-Майне») укладываются в три слова. */
const MAX_CITY_WORDS = 3;

/**
 * Похоже ли значение на адресную строку, а не на название города.
 * Признаки намеренно строгие: лучше показать страну, чем обрезанный адрес.
 */
export function isAddressLikeCityName(value: string | null | undefined): boolean {
    const trimmed = value?.trim();
    if (!trimmed) return false;

    if (trimmed.length > MAX_CITY_LENGTH) return true;
    if (ADDRESS_SEPARATORS.test(trimmed)) return true;
    // Номер дома, почтовый индекс, номер трассы.
    if (/\d/.test(trimmed)) return true;

    const words = trimmed.toLowerCase().split(/\s+/);
    if (words.length > MAX_CITY_WORDS) return true;

    return words.some((word) =>
        NON_CITY_WORD_PREFIXES.some((prefix) => word.startsWith(prefix)),
    );
}

/**
 * Название города для показа или `undefined`, если бэкенд прислал адрес.
 * `undefined` означает «места нет»: вызывающий код показывает страну и не
 * подставляет плейсхолдер и не оставляет висячий разделитель.
 */
export function resolveTravelCityName(cityName: string | null | undefined): string | undefined {
    const trimmed = cityName?.trim();
    if (!trimmed) return undefined;
    return isAddressLikeCityName(trimmed) ? undefined : trimmed;
}
