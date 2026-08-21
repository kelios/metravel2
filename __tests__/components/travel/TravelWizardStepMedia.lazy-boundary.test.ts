import fs from 'fs';
import path from 'path';

const SOURCE_PATH = path.resolve(process.cwd(), 'components/travel/TravelWizardStepMedia.tsx');

describe('TravelWizardStepMedia gallery loading boundary', () => {
  it('keeps GallerySection synchronous so a pending Metro chunk cannot strand the step fallback', () => {
    const source = fs.readFileSync(SOURCE_PATH, 'utf8');

    expect(source).toContain("import GallerySection from '@/components/travel/GallerySection';");
    expect(source).not.toContain("import('@/components/travel/GallerySection')");
    expect(source).not.toContain('GallerySectionLazy');
  });
});
