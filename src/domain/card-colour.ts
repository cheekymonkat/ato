/** CSS grayscale luminance weights; preserve alpha and each colour's relative brightness. */
export function grayscaleColour(colour: string): string {
  const match = colour.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (!match) return colour;
  const hex = match[1].length <= 4 ? [...match[1]].map(char => char + char).join('') : match[1];
  const level = Math.round(0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16));
  return `#${level.toString(16).padStart(2, '0').repeat(3)}${hex.slice(6)}`.toUpperCase();
}

/** Target paint attributes only: hex-looking SVG IDs and gradient references must survive. */
export function grayscaleSvg(xml: string): string {
  return xml.replace(/((?:fill|stroke|stop-color|flood-color|color)=["'])(#[\da-f]{3,8})(["'])/gi,
    (_, prefix: string, colour: string, suffix: string) => `${prefix}${grayscaleColour(colour)}${suffix}`);
}
