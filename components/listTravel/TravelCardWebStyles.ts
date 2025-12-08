/**
 * Web-специфичные стили с media queries для правильной адаптивности в браузере
 * Использует @media queries вместо Platform.select
 */

export const travelCardWebStyles = `
  .travel-card-container {
    width: 100%;
    margin-bottom: 20px;
  }
  
  .travel-card {
    border-radius: 16px;
    margin-bottom: 20px;
  }
  
  .travel-card-image {
    height: 220px;
  }
  
  .travel-card-content {
    padding: 12px;
    padding-top: 10px;
    gap: 8px;
  }
  
  .travel-card-title {
    font-size: 16px;
    line-height: 22px;
    margin-bottom: 2px;
    min-height: 44px;
  }
  
  .travel-card-meta {
    font-size: 12px;
    line-height: 16px;
  }
  
  .travel-card-tag {
    font-size: 11px;
    line-height: 15px;
  }
  
  /* Desktop styles */
  @media (min-width: 768px) {
    .travel-card-container {
      margin-bottom: 24px;
    }
    
    .travel-card {
      border-radius: 20px;
      margin-bottom: 24px;
    }
    
    .travel-card-image {
      height: auto;
      aspect-ratio: 4 / 3;
    }
    
    .travel-card-content {
      padding: 24px;
      padding-top: 21px;
      gap: 15px;
    }
    
    .travel-card-title {
      font-size: 20px;
      line-height: 28px;
      margin-bottom: 6px;
      min-height: 56px;
    }
    
    .travel-card-meta {
      font-size: 14px;
      line-height: 20px;
    }
    
    .travel-card-tag {
      font-size: 13px;
      line-height: 18px;
    }
  }
`;

export function injectTravelCardWebStyles() {
  if (typeof document === 'undefined') return;
  
  const styleId = 'travel-card-web-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = travelCardWebStyles;
  document.head.appendChild(style);
}
