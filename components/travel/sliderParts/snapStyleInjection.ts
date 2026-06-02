import { Platform } from 'react-native'

const STYLE_ID = 'slider-snap-override'

// Inject CSS class for disabling scroll-snap during programmatic scrolling (web only)
export function injectSliderSnapStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
      .slider-snap-disabled { scroll-snap-type: none !important; }
      [data-testid="slider-wrapper"]:hover [aria-label="Previous slide"],
      [data-testid="slider-wrapper"]:hover [aria-label="Next slide"] {
        opacity: 1 !important;
      }
      [aria-label="Previous slide"]:hover,
      [aria-label="Next slide"]:hover {
        background-color: rgba(0,0,0,0.5) !important;
        border-color: rgba(255,255,255,0.3) !important;
        transform: scale(1.08) !important;
      }
      [aria-label="Previous slide"]:active,
      [aria-label="Next slide"]:active { transform: scale(0.95) !important; }
    `
  document.head.appendChild(style)
}
