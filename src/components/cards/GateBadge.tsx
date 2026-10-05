import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { gateLabel } from '../../domain/card-presentation';
import type { DisplayGate } from '../../domain/card-presentation';
import { gateColour } from '../../theme/gear-tokens';
import { gearIcons } from '../../theme/gear-icons';
import { CardIcon, iconKey } from './CardIcon';
import { useCardColours } from './CardColours';
import { useGateCheck } from './GateAssistance';
import { GATE_STATUS_LABELS } from '../../domain/rules-assistance';

function GateIcon({ name, size }: { name: string; size: number }) {
  return gearIcons[iconKey(name, undefined, true)] ? <CardIcon name={name} size={size} invert />
    : <SvgText y={size * 0.75} fontSize={12} fill="#FFFFFF">{name}</SvgText>;
}

export function GateBackground({ gate }: { gate: DisplayGate }) {
  const paint = useCardColours();
  const id = `gate-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <View accessible={false} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
    <Svg width="100%" height="100%"><Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
      <Stop offset="30%" stopColor={paint.colour(gateColour(gate.type))} /><Stop offset="70%" stopColor={paint.colour(gateColour(gate.type2 || gate.type))} />
    </LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`} /></Svg>
  </View>;
}

/** ATCC's split arrow polygons; native SVG uses an explicit padded viewBox instead of DOM getBBox. */
export function GateBadge({ gate, height = 15, stat = false, filled = false }: { gate: DisplayGate; height?: number; stat?: boolean; filled?: boolean }) {
  const paint = useCardColours();
  const check = useGateCheck(gate);
  const firstFill = filled ? paint.colour(gateColour(gate.type)) : 'none';
  const secondFill = filled ? paint.colour(gateColour(gate.type2 || gate.type)) : 'none';
  const condition = gate.type === 'Condition', or = gate.combo === 'OR', and = gate.combo === '&' || gate.combo === 'AND';
  const size = condition ? 26 : gate.type === 'Ambrosia' ? 35 : 22;
  const adjustment = condition ? gate.value.length * 15 : gate.type === 'Ambrosia' ? 5 : 0;
  const width = condition ? 74 + adjustment : 105 + adjustment + (gate.type2 ? size + 5 : 0) + (or ? size : 0);
  const split = condition ? adjustment + 10 : 46 + (or ? size : 0), spacer = or ? 65 : 0;
  const iconX = width - split - 5 - 10 - size - (gate.type2 ? size + 8 : 0) - 5;
  const iconY = 16 - size / 2;
  const viewWidth = width + spacer + 4;
  return <View accessible accessibilityLabel={`${gateLabel(gate)}${check ? `. ${GATE_STATUS_LABELS[check.status]}. ${check.explanation}` : ''}`} style={{ height, width: height * viewWidth / 36, maxWidth: '100%' }}>
    <Svg width="100%" height="100%" viewBox={`-2 -2 ${viewWidth} 36`}>
      {stat ? <Polygon points={`${width - split - 5},0 ${width - split - 15},32 ${width - split},0 ${width - split - 10},32`} stroke="#FFFFFF" strokeWidth={3} fill="none" /> : <>
        <Polygon points={`0,16 12,0 ${width - split - 5},0 ${width - split - 15},32 12,32`} stroke="#FFFFFF" strokeWidth={3} fill={firstFill} />
        {or && <Polygon points={`${width - split},0 ${width - split + spacer - 5},0 ${width - split + spacer - 15},32 ${width - split - 10},32`} stroke="#FFFFFF" strokeWidth={3} fill={firstFill} />}
        <Polygon points={`${width - split + spacer},0 ${width - 12 + spacer},0 ${width + spacer},16 ${width - 12 + spacer},32 ${width - split - 10 + spacer},32`} stroke="#FFFFFF" strokeWidth={3} fill={secondFill} />
      </>}
      <G x={iconX} y={iconY}><GateIcon name={condition ? 'Condition' : gate.type} size={size} />
        {and && gate.type2 && <><SvgText x={size + 6} y={size * 0.75} fontSize={20} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">&amp;</SvgText><G x={size + 12}><GateIcon name={gate.type2} size={size} /></G></>}
        {or && <SvgText x={size * 1.75} y={22} fontSize={26} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">{gate.value}</SvgText>}
      </G>
      <SvgText x={width - split + 5} y={26} fontSize={26} fontWeight="bold" fill="#FFFFFF">{or ? 'OR' : gate.value}</SvgText>
      {or && gate.type2 && <G x={width - split + 5 + spacer} y={iconY}><GateIcon name={gate.type2} size={size} />
        <SvgText x={size * 1.75} y={22} fontSize={26} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">{gate.value2}</SvgText>
      </G>}
    </Svg>
    {check && <Text accessible={false} style={{ position: 'absolute', right: -3, top: -3, width: 12, height: 12,
      borderRadius: 6, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: paint.colour(check.status === 'met' ? '#276B49' : check.status === 'unmet' ? '#8A3835' : '#72571D'),
      color: '#FFFFFF', fontSize: 9, lineHeight: 10, fontWeight: '700', textAlign: 'center' }}>{check.status === 'met' ? '✓' : check.status === 'unmet' ? '−' : '?'}</Text>}
  </View>;
}

export function StatGate({ gate, scale }: { gate: DisplayGate; scale: number }) {
  return <View style={{ alignItems: 'center', paddingVertical: gate.type.includes('Hit') ? scale : 0, minHeight: 12.8 * scale }}>
    <GateBackground gate={gate} />
    {gate.type === 'Hits' || gate.type === 'Full Hit' || !gate.value ? <Text style={{ color: '#FFFFFF', fontSize: 10 * scale, lineHeight: 12.8 * scale, textAlign: 'center' }}>
      {gate.type === 'Hits' ? `${gate.value} ${gate.value === '1' ? 'Hit' : 'Hits'}` : gate.type}
    </Text> : <GateBadge gate={gate} height={12.8 * scale} stat />}
  </View>;
}
