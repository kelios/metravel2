/** uuid4 без внешней зависимости: crypto, где он есть, иначе Math.random. */
export function createUuidV4(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof cryptoRef?.getRandomValues === 'function') {
    cryptoRef.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Версия 4 и вариант RFC 4122 — сервер хранит поле как uuid.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
