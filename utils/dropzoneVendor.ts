// #1148 (по канону #765/leafletVendor): единственная точка sync-импорта
// react-dropzone. Все потребители получают вендора только через
// `await import('@/utils/dropzoneVendor')` в lazy-фабриках — второй
// sync-импортёр в другом async-чанке заставил бы Metro хойстить вендора
// (react-dropzone + file-selector, ~100 КБ transformed) в web-__common,
// который грузится на каждой странице.
export { useDropzone } from 'react-dropzone'
