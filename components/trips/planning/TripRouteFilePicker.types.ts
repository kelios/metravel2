/**
 * Исходный файл для загрузки на бэкенд (#1496). Держим именно выбранный файл,
 * а не пересобранный из текста Blob: контракт фазы 2 требует, чтобы скачанный
 * оригинал побайтно совпал с загруженным, а повторная сборка из UTF-8-строки
 * теряет BOM и исходную кодировку.
 */
export type PickedTripRouteFileUpload =
  | { kind: 'web'; file: File }
  | { kind: 'native'; uri: string; name: string; mimeType?: string };

export type PickedTripRouteFile = {
  name: string;
  size: number | null;
  text: string;
  upload: PickedTripRouteFileUpload;
};

/** Часть multipart-запроса: web отдаёт `File`, native — RN-часть `{ uri, name, type }`. */
export const toRouteFileUploadPart = (
  upload: PickedTripRouteFileUpload,
): File | { uri: string; name: string; type?: string } =>
  upload.kind === 'web'
    ? upload.file
    : { uri: upload.uri, name: upload.name, type: upload.mimeType };

export type TripRouteFilePickerError = 'tooLarge' | 'read';

export type TripRouteFilePickerProps = {
  label: string;
  maxBytes: number;
  disabled?: boolean;
  loading?: boolean;
  onPicked: (file: PickedTripRouteFile) => void;
  onError: (error: TripRouteFilePickerError) => void;
  onBusyChange?: (busy: boolean) => void;
  testID?: string;
};
