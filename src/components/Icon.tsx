import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { gameIcons } from '../theme/game-icons';
import { theme } from '../theme/tokens';

export type GameIconName = keyof typeof gameIcons;
export function GameIcon({ name, size = 24 }: { name: GameIconName; size?: number }) {
  return <SvgXml xml={gameIcons[name]} width={size} height={size} />;
}

export function Chevron({ direction = 'right', colour = theme.ink }: { direction?: 'left' | 'right' | 'down'; colour?: string }) {
  const path = direction === 'left' ? 'M14 5l-7 7 7 7' : direction === 'down' ? 'M5 8l7 7 7-7' : 'M9 5l7 7-7 7';
  return <Svg width={18} height={18} viewBox="0 0 24 24"><Path d={path} fill="none" stroke={colour} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
export function Emblem() {
  return <Svg width={40} height={40} viewBox="0 0 40 40">
    <Circle cx={20} cy={20} r={18} fill="none" stroke={theme.gold} strokeWidth={1} />
    <Path d="M11 27l9-18 9 18M15 20h10M10 29h20M20 9v23" fill="none" stroke={theme.gold} strokeWidth={1.2} />
  </Svg>;
}
