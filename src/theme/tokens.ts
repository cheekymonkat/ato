import { Platform } from 'react-native';

export const theme = {
  canvas: '#F3F2EF', panel: '#E6E3DB', paper: '#FAF9F6', ink: '#292723',
  muted: '#706D65', line: '#D1CDC3', charcoal: '#333333', gold: '#B49A60',
  danger: '#A3423D', white: '#FFFFFF',
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  maxWidth: 1240,
} as const;

export const colourChoices = [
  { name: 'Terracotta', value: '#B54A48', background: '#F3E5E3' }, { name: 'Aegean', value: '#416EAA', background: '#E5ECF3' },
  { name: 'Olive', value: '#547E59', background: '#E7EEE5' }, { name: 'Ochre', value: '#B38A35', background: '#EEE8DA' },
  { name: 'Amethyst', value: '#806191', background: '#EDE7F0' }, { name: 'Teal', value: '#347C7A', background: '#E4EEED' },
  { name: 'Slate', value: '#626976', background: '#E9EAED' }, { name: 'Copper', value: '#B46A3C', background: '#F3E9E2' },
] as const;

/** Blend saved #RRGGBB colours without changing the saved identity colour. */
function blendColour(colour: string, target: number, amount: number): string {
  return '#' + [1, 3, 5].map(offset => {
    const channel = parseInt(colour.slice(offset, offset + 2), 16);
    return Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

export function argonautColourBackground(colour: string): string {
  return colourChoices.find(choice => choice.value === colour.toUpperCase())?.background
    ?? blendColour(colour, 255, 0.85);
}

export function textOnColour(colour: string): string {
  const red = parseInt(colour.slice(1, 3), 16), green = parseInt(colour.slice(3, 5), 16), blue = parseInt(colour.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? theme.ink : theme.white;
}
