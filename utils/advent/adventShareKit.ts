// Ленивый модуль шеринга адвента (#2868). Экран `/advent` грузит его отдельным
// чанком при показе карточки, а не статически: статический импорт тянул в граф
// маршрута `utils/urlParams`/`utils/utm` и перекраивал общие чанки сайта — у
// `/search` прибавлялся лишний начальный запрос сверх бюджета (выкат 4f5237432).
export { downloadAdventCard, shareAdventCard } from '@/utils/advent/adventShare'
export { renderAdventCardPng } from '@/utils/advent/adventShareImage'
