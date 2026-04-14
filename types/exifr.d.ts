declare module 'exifr/dist/lite.esm.mjs' {
  export function gps(
    input: File | Blob | ArrayBuffer,
  ): Promise<{ latitude: number; longitude: number } | null>
  const exifr: { gps: typeof gps }
  export default exifr
}
