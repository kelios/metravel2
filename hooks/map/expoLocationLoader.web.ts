let expoLocationModulePromise: Promise<typeof import('expo-location')> | null = null;

export async function loadExpoLocation() {
  if (!expoLocationModulePromise) {
    expoLocationModulePromise = Promise.resolve(import('expo-location'));
  }
  return expoLocationModulePromise;
}
