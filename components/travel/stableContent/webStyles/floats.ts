import type { useThemedColors } from '@/hooks/useTheme'

export const floatStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
  supportsContainerQueries = true,
): string => `
.${cls} {
  container-type: inline-size;
}

/* ===== SINGLE WIDE IMAGE (horizontal/landscape) ===== */
.${cls} .img-single-wide {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 1.6em 0 1.8em;
  clear: both;
  text-align: center;
}
.${cls} .img-single-wide img {
  width: min(100%, 74vw);
  max-width: min(100%, 74vw);
  max-height: 52vh;
  height: auto;
  margin: 0 auto;
  border-radius: 16px;
  object-fit: contain;
  box-shadow: ${colors.boxShadows?.light || 'none'};
}

.${cls} .figure-landscape {
  margin: 1.8em 0 2em;
}

.${cls} .figure-landscape img {
  width: min(100%, 76vw);
  max-width: min(100%, 76vw);
  max-height: 50vh;
}

/* ===== SINGLE IMAGE WITH FLOAT (desktop, vertical/square images only) ===== */
@media (min-width: 769px) {
  .${cls} .img-float-right,
  .${cls} .img-float-left {
    display: block;
    width: min(45%, 420px);
    max-width: 45%;
    box-sizing: border-box;
    margin-top: 0.35em;
    margin-bottom: 1em;
    clear: both;
  }

  .${cls} .img-float-right {
    float: right;
    margin-right: 0;
    margin-left: 16px;
  }

  .${cls} .img-float-left {
    float: left;
    margin-right: 16px;
    margin-left: 0;
  }

  .${cls} .img-float-right img,
  .${cls} .img-float-left img {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: min(48vh, 520px);
    object-fit: contain;
    margin: 0;
    border-radius: 16px;
    box-shadow: ${colors.boxShadows?.light || 'none'};
  }

  .${cls} figure.img-float-right,
  .${cls} figure.img-float-left {
    align-items: stretch;
    padding: 0;
    text-align: center;
  }

  .${cls} figure.img-float-right figcaption,
  .${cls} figure.img-float-left figcaption {
    padding-right: 0;
    padding-left: 0;
  }

  .${cls} .figure-portrait {
    margin-top: 0.35em;
    margin-bottom: 1em;
  }

  .${cls} .figure-portrait img {
    width: 100%;
    max-width: 100%;
    max-height: min(48vh, 520px);
  }
}

${supportsContainerQueries ? `/* A desktop viewport can still contain a narrow article column (sidebar/split
   view). In that case the available column, not the window, disables wrapping. */
@container (max-width: 560px) {
  .${cls} .img-float-right,
  .${cls} .img-float-left {
    float: none;
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 1em 0;
    clear: both;
  }
}` : ''}
`
