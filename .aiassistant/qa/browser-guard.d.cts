import type {Page} from 'playwright';

declare const guard: {
  installGuard(page: Page, record: (entry: Record<string, unknown>) => void): Promise<void>;
  fileRecorder(directory: string): (entry: Record<string, unknown>) => void;
};
export = guard;
