// Примитивы SVG для иконок навигации (#3234). На native — react-native-svg;
// на web — `navigationIconSvg.web.tsx`: обычные DOM-элементы `<svg>`, чтобы
// иконки дока и шапки не тянули react-native-svg (~55 КБ) в общий чанк
// каждой страницы. Геометрия иконок одна — в `NavigationIcon`/`BelarusOutlineIcon`.
export { default, Circle, G, Path, Rect } from 'react-native-svg'
