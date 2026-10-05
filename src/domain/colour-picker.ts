export interface HsvColour { hue: number; saturation: number; value: number }
export const COLOUR_WHEEL_SIZE = 300;
export const COLOUR_WHEEL_RADIUS = 140;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;

export function hexToHsv(colour: string): HsvColour {
  const [red, green, blue] = [1, 3, 5].map(offset => parseInt(colour.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
  const sector = !delta ? 0 : max === red ? (green - blue) / delta
    : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return { hue: wrapHue(sector * 60), saturation: max === 0 ? 0 : delta / max, value: max };
}

export function hsvToHex({ hue, saturation, value }: HsvColour): string {
  const sector = wrapHue(hue) / 60, chroma = clamp(value) * clamp(saturation);
  const x = chroma * (1 - Math.abs(sector % 2 - 1)), offset = clamp(value) - chroma;
  const channels = sector < 1 ? [chroma, x, 0] : sector < 2 ? [x, chroma, 0]
    : sector < 3 ? [0, chroma, x] : sector < 4 ? [0, x, chroma] : sector < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return '#' + channels.map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Red starts on the right; hue increases clockwise. Outside drags clamp to the rim. */
export function colourWheelSelection(x: number, y: number, size: number): Pick<HsvColour, 'hue' | 'saturation'> {
  const dx = x - size / 2, dy = y - size / 2;
  return { hue: wrapHue(Math.atan2(dy, dx) * 180 / Math.PI),
    saturation: clamp(Math.hypot(dx, dy) / (size * COLOUR_WHEEL_RADIUS / COLOUR_WHEEL_SIZE)) };
}

export function colourWheelMarker({ hue, saturation }: HsvColour): { x: number; y: number } {
  const angle = hue * Math.PI / 180, radius = clamp(saturation) * COLOUR_WHEEL_RADIUS;
  return { x: COLOUR_WHEEL_SIZE / 2 + Math.cos(angle) * radius, y: COLOUR_WHEEL_SIZE / 2 + Math.sin(angle) * radius };
}

/** The brightness track has eight units of padding inside its 300-unit SVG. */
export function colourBrightnessSelection(x: number, width: number): number {
  return clamp((x / width * 300 - 8) / 284);
}
