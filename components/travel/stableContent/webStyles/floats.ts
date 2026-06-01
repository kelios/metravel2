import type { useThemedColors } from '@/hooks/useTheme'

export const floatStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => `
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
  .${cls} .img-float-right {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    max-width: 100%;
    margin: 1.4em 0 1.6em;
    clear: both;
  }
  .${cls} .img-float-right img {
    width: clamp(260px, 52%, 420px);
    max-height: 48vh;
    object-fit: contain;
    margin: 0;
    border-radius: 16px;
    box-shadow: ${colors.boxShadows?.light || 'none'};
  }
  .${cls} .img-float-left {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    max-width: 100%;
    margin: 1.4em 0 1.6em;
    clear: both;
  }
  .${cls} .img-float-left img {
    width: clamp(260px, 52%, 420px);
    max-height: 48vh;
    object-fit: contain;
    margin: 0;
    border-radius: 16px;
    box-shadow: ${colors.boxShadows?.light || 'none'};
  }

  .${cls} .figure-portrait {
    margin: 1.6em 0 1.8em;
  }

  .${cls} .figure-portrait.img-float-right {
    padding-left: clamp(24px, 5vw, 64px);
  }

  .${cls} .figure-portrait.img-float-left {
    padding-right: clamp(24px, 5vw, 64px);
  }

  .${cls} .figure-portrait img {
    width: clamp(280px, 56%, 440px);
    max-width: min(100%, 440px);
    max-height: min(48vh, 520px);
  }
}
`
