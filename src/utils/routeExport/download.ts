import type { RouteExportResult } from './types';

export const downloadTextFileWeb = (file: RouteExportResult) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Release object URL a bit later to avoid Safari issues
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

