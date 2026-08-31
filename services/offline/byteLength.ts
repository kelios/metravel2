// #1643: посимвольный цикл по всей строке пакета попадал в окно boot — прод-профиль
// travel-детали 2026-08-30 (mobile, CPU ×4) отнёс на него 23.3 мс блокировки
// главного потока при записи offline-пакета в IndexedDB. `TextEncoder` считает то
// же самое нативно. Ручной цикл остаётся фолбэком: в Hermes-сборке Android
// `TextEncoder` может отсутствовать, как и часть `Intl`.
const utf8Encoder: TextEncoder | null =
  typeof TextEncoder === 'function' ? new TextEncoder() : null;

const utf8ByteLengthByCodePoint = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

export const utf8ByteLength = (value: string): number => {
  if (utf8Encoder) return utf8Encoder.encode(value).length;
  return utf8ByteLengthByCodePoint(value);
};
