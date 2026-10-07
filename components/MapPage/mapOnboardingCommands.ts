// Shared command lifecycle without importing the lazy tour UI into MapScreen.
let restartCallback: (() => void) | null = null;
let restartPending = false;

export function requestMapOnboardingRestart(): void {
  if (restartCallback) restartCallback();
  else restartPending = true;
}

export function cancelMapOnboardingRestart(): void {
  restartPending = false;
}

export function registerMapOnboardingRestart(callback: () => void): () => void {
  restartCallback = callback;
  return () => {
    if (restartCallback === callback) {
      restartCallback = null;
      restartPending = false;
    }
  };
}

export function consumeMapOnboardingRestart(): void {
  if (!restartPending || !restartCallback) return;
  restartPending = false;
  restartCallback();
}
