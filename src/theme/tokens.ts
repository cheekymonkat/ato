import { Platform } from 'react-native';

export const theme = {
  canvas: '#F3F2EF', panel: '#E6E3DB', paper: '#FAF9F6', ink: '#292723',
  muted: '#706D65', line: '#D1CDC3', charcoal: '#333333', gold: '#B49A60',
  danger: '#A3423D', white: '#FFFFFF',
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  maxWidth: 1240,
} as const;

export const colourChoices = [
  { name: 'Terracotta', value: '#B54A48' }, { name: 'Aegean', value: '#416EAA' },
  { name: 'Olive', value: '#547E59' }, { name: 'Ochre', value: '#B38A35' },
  { name: 'Amethyst', value: '#806191' }, { name: 'Teal', value: '#347C7A' },
  { name: 'Slate', value: '#626976' }, { name: 'Copper', value: '#B46A3C' },
] as const;

export function textOnColour(colour: string): string {
  const red = parseInt(colour.slice(1, 3), 16), green = parseInt(colour.slice(3, 5), 16), blue = parseInt(colour.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? theme.ink : theme.white;
}
