type DropMarkerOptions = {
  size: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  innerColor?: string;
  innerRadius?: number;
};

const DROP_PATH = 'M12 22s7-4.5 7-12a7 7 0 0 0-14 0c0 7.5 7 12 7 12Z';

export const buildDropMarkerHtml = ({
  size,
  fill,
  stroke = 'rgb(175, 125, 75)',
  strokeWidth = 1,
  innerColor = 'rgb(255, 255, 255)',
  innerRadius = 3,
}: DropMarkerOptions) => {
  return `
    <div style="width:${size}px;height:${size}px;position:relative;transform:translate(-${size / 2}px,-${size}px);">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="${DROP_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
        <circle cx="12" cy="10" r="${innerRadius}" fill="${innerColor}" />
      </svg>
    </div>
  `;
};
