import { useId } from 'react';
import { Text } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { gearIcons } from '../../theme/gear-icons';
import { useCardColours } from './CardColours';

const nonInvertible = new Set(['Progress', 'Reveal', 'RedPowerDie', 'RedArmorDie', 'BlackPowerDie', 'BlackArmorDie', 'WhitePowerDie', 'WhiteArmorDie', 'MortalPowerDie', 'MortalArmorDie', 'Doom', 'WoO', 'PriorityTarget', 'ToHit', 'InvertedDoom', 'InvertedProgress']);
export function iconKey(name: string, type?: 'Power' | 'Armor', invert = false): string {
  const reversed = name.startsWith('Reversed'), base = name.replace(/^Reversed/, '');
  const aliases: Record<string, string> = { '1 Hand': 'OneHanded', '2 Hands': 'TwoHanded', '3 Hands': 'ThreeHanded', '2 1 Hands': 'TwoOneHanded', '3 1 Hands': 'ThreeOneHanded', AdversaryActivation: 'Adversary', Labyrinth: 'Labyrinthians', Reroll: type === 'Armor' ? 'EvasionReroll' : 'PowerReroll', Laser: type === 'Armor' ? 'LaserResistance' : 'Laser', Microwave: type === 'Armor' ? 'MicrowaveResistance' : 'Microwave' };
  let key = type && ['Red', 'Black', 'White', 'Mortal'].includes(base) ? `${base}${type}Die` : aliases[base] || base;
  if (reversed) key = `Reversed${key}`;
  if (invert && ['Progress', 'Doom'].includes(key)) key = `Inverted${key}`;
  return key;
}
const inverted = new Map<string, string>();
function invertSvg(key: string, xml: string) {
  if (inverted.has(key)) return inverted.get(key)!;
  const result = xml.replace(/(fill|stroke)="(#[\da-f]{3,8}|black|white)"/gi, (_, attribute: string, colour: string) => {
    if (colour === 'black' || colour === 'white') return `${attribute}="${colour === 'black' ? 'white' : 'black'}"`;
    let hex = colour.slice(1);
    if (hex.length === 3) hex = [...hex].map(char => char + char).join('');
    if (![6, 8].includes(hex.length)) return `${attribute}="${colour}"`;
    return `${attribute}="#${[0, 2, 4].map(i => (255 - parseInt(hex.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join('')}${hex.slice(6)}"`;
  });
  const withDefaultFill = /^<svg\b[^>]*\bfill=/.test(result) ? result : result.replace('<svg ', '<svg fill="#ffffff" ');
  inverted.set(key, withDefaultFill); return withDefaultFill;
}

export function CardIcon({ name, size = 13, type, invert = false, colour = '#000000', tint }: { name: string; size?: number; type?: 'Power' | 'Armor'; invert?: boolean; colour?: string; tint?: string }) {
  const paint = useCardColours();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, ''), key = iconKey(name, type, invert);
  const source = gearIcons[key];
  if (!source) return <Text accessibilityLabel={`Missing symbol: ${name}`} style={{ color: paint.colour(colour), fontSize: size, flexShrink: 1 }}>{name}</Text>;
  let xml = invert && !nonInvertible.has(key) ? invertSvg(key, source) : source;
  if (tint) {
    xml = xml.replace(/(fill|stroke)="(?:#000000|#000|black)"/gi, `$1="${tint}"`);
    if (!/^<svg\b[^>]*\bfill=/.test(xml)) xml = xml.replace('<svg ', `<svg fill="${tint}" `);
  }
  xml = paint.svg(xml);
  // Isolate SVG IDs on web when the same symbol occurs several times in a card.
  const ids = [...xml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  for (const svgId of ids) { xml = xml.replaceAll(`id="${svgId}"`, `id="${svgId}-${id}"`).replaceAll(`url(#${svgId})`, `url(#${svgId}-${id})`).replaceAll(`href="#${svgId}"`, `href="#${svgId}-${id}"`); }
  const box = source.match(/viewBox="([^\"]+)"/)?.[1].split(/\s+/).map(Number);
  const ratio = box ? box[2] / box[3] : 1, wide = ['ComplicatedAction', 'PrimordialZoneMarker'].includes(key) ? 2 : 1;
  return <SvgXml aria-hidden xml={xml} width={size * Math.min(ratio, wide)} height={size} />;
}
