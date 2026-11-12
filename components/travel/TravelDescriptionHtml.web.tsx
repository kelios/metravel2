import React, { useEffect, useMemo, useRef } from 'react';

import type { TravelDescriptionHtmlProps } from './TravelDescriptionHtml.types';
import {
  getWebRichTextStyles,
  WEB_RICH_TEXT_CLASS,
  WEB_RICH_TEXT_FULL_WIDTH_CLASS,
} from './stableContent/webStyles';
import { useThemedColors } from '@/hooks/useTheme';
import { inertMarkup } from '@/utils/inertHtml';
import { releaseDeferredRichTextImages } from '@/utils/richTextDeferredImages';

export type { TravelDescriptionHtmlProps } from './TravelDescriptionHtml.types';

export default function TravelDescriptionHtml({ html, fullWidth }: TravelDescriptionHtmlProps) {
  const colors = useThemedColors();
  const islandRef = useRef<HTMLDivElement | null>(null);
  // Keep server and first client markup identical, independent of browser APIs.
  const styles = useMemo(() => getWebRichTextStyles(colors), [colors]);
  const className = fullWidth
    ? `${WEB_RICH_TEXT_CLASS} ${WEB_RICH_TEXT_FULL_WIDTH_CLASS}`
    : WEB_RICH_TEXT_CLASS;

  // #3316: в документе адреса возвращает оболочка (richTextDeferredImagesShell.ts);
  // остров, смонтированный клиентом, возвращает их сам.
  useEffect(() => {
    if (islandRef.current) releaseDeferredRichTextImages(islandRef.current);
  }, [html]);

  return (
    <>
      <style data-travel-description-styles="">{styles}</style>
      <div
        ref={islandRef}
        data-ssr-html-island="description"
        className={className}
        dangerouslySetInnerHTML={inertMarkup(html)}
      />
    </>
  );
}
