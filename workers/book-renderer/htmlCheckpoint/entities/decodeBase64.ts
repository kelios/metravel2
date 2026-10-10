// Derived from entities 7.0.1 decode-shared; see LICENSE-entities and UPSTREAM.json.
// The private worker runtime supports global atob (Node >=16).
export function decodeBase64(input: string): Uint16Array {
  const binary = atob(input); const evenLength = binary.length & ~1
  const out = new Uint16Array(evenLength / 2)
  for (let index = 0, output = 0; index < evenLength; index += 2) {
    out[output++] = binary.charCodeAt(index) | (binary.charCodeAt(index + 1) << 8)
  }
  return out
}
