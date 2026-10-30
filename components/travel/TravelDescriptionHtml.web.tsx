import React, { useMemo } from 'react';

import type { TravelDescriptionHtmlProps } from './TravelDescriptionHtml.types';
import {
  getWebRichTextStyles,
  WEB_RICH_TEXT_CLASS,
  WEB_RICH_TEXT_FULL_WIDTH_CLASS,
} from './stableContent/webStyles';
import { useThemedColors } from '@/hooks/useTheme';

export type { TravelDescriptionHtmlProps } from './TravelDescriptionHtml.types';

export default function TravelDescriptionHtml({ html, fullWidth }: TravelDescriptionHtmlProps) {
  const colors = useThemedColors();
  // Keep server and first client markup identical, independent of browser APIs.
  const styles = useMemo(() => getWebRichTextStyles(colors), [colors]);
  const className = fullWidth
    ? `${WEB_RICH_TEXT_CLASS} ${WEB_RICH_TEXT_FULL_WIDTH_CLASS}`
    : WEB_RICH_TEXT_CLASS;

  return (
    <>
      <style data-travel-description-styles="">{styles}</style>
      <div
        data-ssr-html-island="description"
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
