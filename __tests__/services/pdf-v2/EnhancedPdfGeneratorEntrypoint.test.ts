import { EnhancedPdfGenerator as CompatibilityEntrypoint } from '@/services/pdf-export/generators/EnhancedPdfGenerator';
import { EnhancedPdfGenerator as CanonicalV2Entrypoint } from '@/services/pdf-export/generators/v2/EnhancedPdfGenerator';

describe('EnhancedPdfGenerator entrypoints', () => {
  it('keeps the legacy import-path aligned with the canonical v2 orchestrator', () => {
    expect(CompatibilityEntrypoint).toBe(CanonicalV2Entrypoint);
    expect(new CompatibilityEntrypoint('minimal')).toBeInstanceOf(CanonicalV2Entrypoint);
  });
});
