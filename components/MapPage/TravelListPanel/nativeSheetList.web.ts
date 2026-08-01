// Web-резолюция адаптера: на web TravelListPanel рендерит собственную
// ScrollView-ветку (IS_WEB) раньше, чем дойдёт до sheet-списка, поэтому
// Gorhom здесь не нужен — иначе @gorhom/bottom-sheet (+reanimated-вендоры,
// ~165 КБ transformed) попадает в web-__common мёртвым грузом. Если ветка
// когда-нибудь станет достижимой, FlashList — рабочий эквивалент, а не
// fail-open заглушка.
export { FlashList as BottomSheetFlatList } from '@shopify/flash-list'
