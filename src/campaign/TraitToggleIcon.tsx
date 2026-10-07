import Svg, { Circle, Path } from 'react-native-svg';

export function TraitToggleIcon({ disabled }: { disabled: boolean }) {
  const colour = disabled ? '#A3423D' : '#347C7A';
  return <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false} aria-hidden>
    <Circle cx={12} cy={12} r={9} fill="none" stroke={colour} strokeWidth={1.7} />
    <Path d={disabled ? 'M 5.7 5.7 L 18.3 18.3' : 'M 7 12 L 10.5 15.5 L 17 8.5'} fill="none" stroke={colour} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
