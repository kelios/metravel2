/**
 * Global CSS styles for Slider component
 * Injected once on web platform
 */

export function injectSliderGlobalStyles() {
  if (typeof document === 'undefined') return;

  const STYLE_ID = 'slider-web-global-styles';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Navigation button hover effects */
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
    [aria-label="Next slide"]:active {
      transform: scale(0.95) !important;
    }

    /* ✅ OPTIMIZATION: Pulse animation for loading placeholders */
    @keyframes sliderPulse {
      0%, 100% {
        opacity: 0.3;
      }
      50% {
        opacity: 0.15;
      }
    }

    /* Image loading fade-in animation */
    @keyframes sliderFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
