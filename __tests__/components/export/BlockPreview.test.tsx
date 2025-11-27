import React from 'react';
import TestRenderer from 'react-test-renderer';
import BlockPreview from '@/components/export/BlockPreview';
import { BLOCK_METADATA } from '@/src/types/pdf-layout';

const baseBlock = {
  id: '1',
  type: 'cover' as const,
  config: {},
} as any;

describe('BlockPreview (smoke)', () => {
  const renderBlock = (type: string, metaKey: keyof typeof BLOCK_METADATA) => {
    TestRenderer.create(
      <BlockPreview block={{ ...baseBlock, type }} meta={BLOCK_METADATA[metaKey]} />,
    ).toJSON();
  };

  it('mounts without crashing for basic block types', () => {
    renderBlock('cover', 'cover');
    renderBlock('toc', 'toc');
    renderBlock('photo', 'photo');
    renderBlock('description', 'description');
    renderBlock('recommendation', 'recommendation');
    renderBlock('gallery', 'gallery');
    renderBlock('map', 'map');
    renderBlock('qr', 'qr');
    renderBlock('spacer', 'spacer');
  });
});
