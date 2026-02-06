// src/utils/imageAnalysis.ts
// Утилиты для анализа изображений (яркость, композиция)

/**
 * Анализирует среднюю яркость изображения
 * @param imageUrl URL изображения
 * @returns Средняя яркость от 0 до 255
 */
export async function analyzeImageBrightness(imageUrl: string): Promise<number> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 128; // Дефолтное значение для SSR
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(128);
          return;
        }

        // Уменьшаем размер для быстрого анализа
        const scale = 0.1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let totalBrightness = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Формула яркости (weighted average)
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          totalBrightness += brightness;
        }
        
        const averageBrightness = totalBrightness / pixelCount;
        resolve(Math.round(averageBrightness));
      } catch (error) {
        console.warn('Failed to analyze image brightness:', error);
        resolve(128);
      }
    };
    
    img.onerror = () => {
      console.warn('Failed to load image for brightness analysis');
      resolve(128);
    };
    
    img.src = imageUrl;
  });
}

/**
 * Анализирует композицию изображения (где больше деталей)
 * @param imageUrl URL изображения
 * @returns Объект с уровнем занятости зон (0-1)
 */
export async function analyzeImageComposition(imageUrl: string): Promise<{
  topBusy: number;
  centerBusy: number;
  bottomBusy: number;
}> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve({ topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 });
          return;
        }

        const scale = 0.1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const height = canvas.height;
        const width = canvas.width;
        
        // Делим изображение на 3 зоны по вертикали
        const zoneHeight = Math.floor(height / 3);
        
        const zones = {
          top: { variance: 0, count: 0 },
          center: { variance: 0, count: 0 },
          bottom: { variance: 0, count: 0 },
        };
        
        // Вычисляем дисперсию яркости для каждой зоны
        for (let y = 0; y < height; y++) {
          const zone = y < zoneHeight ? 'top' : y < zoneHeight * 2 ? 'center' : 'bottom';
          
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            zones[zone].variance += brightness;
            zones[zone].count++;
          }
        }
        
        // Нормализуем значения (0-1)
        const maxVariance = Math.max(
          zones.top.variance,
          zones.center.variance,
          zones.bottom.variance
        );
        
        resolve({
          topBusy: maxVariance > 0 ? zones.top.variance / maxVariance : 0.5,
          centerBusy: maxVariance > 0 ? zones.center.variance / maxVariance : 0.5,
          bottomBusy: maxVariance > 0 ? zones.bottom.variance / maxVariance : 0.5,
        });
      } catch (error) {
        console.warn('Failed to analyze image composition:', error);
        resolve({ topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 });
      }
    };
    
    img.onerror = () => {
      console.warn('Failed to load image for composition analysis');
      resolve({ topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 });
    };
    
    img.src = imageUrl;
  });
}

/**
 * Определяет оптимальную позицию текста на основе композиции
 */
export function getOptimalTextPosition(composition: {
  topBusy: number;
  centerBusy: number;
  bottomBusy: number;
}): 'top' | 'center' | 'bottom' {
  const { topBusy, centerBusy, bottomBusy } = composition;
  
  // Выбираем наименее загруженную зону
  if (topBusy <= centerBusy && topBusy <= bottomBusy) {
    return 'top';
  }
  if (bottomBusy <= centerBusy && bottomBusy <= topBusy) {
    return 'bottom';
  }
  return 'center';
}

/**
 * Вычисляет оптимальную прозрачность overlay на основе яркости
 */
export function getOptimalOverlayOpacity(brightness: number): number {
  // Светлое изображение (>128) - более темный overlay
  // Темное изображение (<128) - более светлый overlay
  if (brightness > 180) return 0.7;
  if (brightness > 128) return 0.6;
  if (brightness > 80) return 0.4;
  return 0.3;
}

/**
 * Определяет цвет overlay на основе яркости
 */
export function getOptimalOverlayColor(brightness: number): string {
  // Светлое изображение - черный overlay
  // Темное изображение - белый overlay для контраста
  return brightness > 128 ? 'rgba(0,0,0,' : 'rgba(255,255,255,';
}

/**
 * Определяет цвет текста на основе яркости фона
 */
export function getOptimalTextColor(brightness: number): string {
  return brightness > 128 ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
}
