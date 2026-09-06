export const CHUNK_RELOAD_SCRIPT_ID: string;
export function getChunkReloadBootstrapScript(): string;
export function reloadOnceForStaleChunk(win: Window): boolean;

declare global {
  interface Window {
    __metravelReloadStaleChunk?: () => boolean;
  }
}
