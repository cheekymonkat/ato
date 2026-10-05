import { memo, useCallback, useId, useMemo, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { COLOUR_WHEEL_RADIUS, COLOUR_WHEEL_SIZE, colourBrightnessSelection, colourWheelMarker, colourWheelSelection, hsvToHex } from '../domain/colour-picker';
import type { HsvColour } from '../domain/colour-picker';
import { theme } from '../theme/tokens';
import { SwipeGuard } from './SwipeSurface';

const segments = Array.from({ length: 180 }, (_, index) => {
  const start = index * 2 * Math.PI / 180, end = (index * 2 + 2) * Math.PI / 180;
  const point = (angle: number) => `${150 + Math.cos(angle) * COLOUR_WHEEL_RADIUS},${150 + Math.sin(angle) * COLOUR_WHEEL_RADIUS}`;
  return { path: `M150,150 L${point(start)} A140,140 0 0 1 ${point(end)} Z`,
    colour: hsvToHex({ hue: index * 2 + 1, saturation: 1, value: 1 }) };
});

/** Cache the spectrum while the marker and brightness change during a drag. */
const Spectrum = memo(function Spectrum({ gradientId }: { gradientId: string }) {
  return <G>
    <Defs><RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} /><Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
    </RadialGradient></Defs>
    {segments.map((segment, index) => <Path key={index} d={segment.path} fill={segment.colour} stroke={segment.colour} strokeWidth={0.5} />)}
    <Circle cx={150} cy={150} r={COLOUR_WHEEL_RADIUS} fill={`url(#${gradientId})`} />
  </G>;
});

function createColourDrag(onChange: (x: number, y: number) => void) {
  // Per-gesture coordinates belong to the responder, rather than rendered state.
  let startX = 0, startY = 0;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      startX = event.nativeEvent.locationX; startY = event.nativeEvent.locationY;
      onChange(startX, startY);
    },
    onPanResponderMove: (_, gesture) => onChange(startX + gesture.dx, startY + gesture.dy),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }).panHandlers;
}

function useColourDrag(onChange: (x: number, y: number) => void) {
  return useMemo(() => createColourDrag(onChange), [onChange]);
}

export function ColourWheel({ colour, onChange }: { colour: HsvColour; onChange: (selection: Pick<HsvColour, 'hue' | 'saturation'>) => void }) {
  const [size, setSize] = useState(240);
  const gradientId = `wheel-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const select = useCallback((x: number, y: number) => onChange(colourWheelSelection(x, y, size)), [onChange, size]);
  const handlers = useColourDrag(select), marker = colourWheelMarker(colour);
  return <SwipeGuard><View style={[styles.wheel, webDragStyle]} onLayout={event => setSize(event.nativeEvent.layout.width)} {...handlers}
    testID="colour-wheel" accessible accessibilityRole="image" accessibilityLabel="Colour wheel"
    accessibilityHint="Drag to choose hue and saturation. Hue and saturation buttons below allow fine adjustment.">
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${COLOUR_WHEEL_SIZE} ${COLOUR_WHEEL_SIZE}`}>
        <Spectrum gradientId={gradientId} />
        <Circle cx={150} cy={150} r={COLOUR_WHEEL_RADIUS} fill="#000000" opacity={1 - colour.value} />
        <Circle cx={150} cy={150} r={COLOUR_WHEEL_RADIUS} fill="none" stroke={theme.line} strokeWidth={1} />
        <Circle cx={marker.x} cy={marker.y} r={8} fill={hsvToHex(colour)} stroke="#FFFFFF" strokeWidth={3} />
        <Circle cx={marker.x} cy={marker.y} r={10} fill="none" stroke={theme.ink} strokeWidth={1.5} />
      </Svg>
    </View>
  </View></SwipeGuard>;
}

export function ColourBrightness({ colour, onChange }: { colour: HsvColour; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(240);
  const gradientId = `brightness-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const select = useCallback((x: number) => onChange(colourBrightnessSelection(x, width)), [onChange, width]);
  const handlers = useColourDrag(select);
  return <SwipeGuard><View style={[styles.brightness, webDragStyle]} onLayout={event => setWidth(event.nativeEvent.layout.width)} {...handlers}
    testID="colour-brightness" accessible accessibilityRole="adjustable" accessibilityLabel="Brightness"
    accessibilityValue={{ min: 0, max: 100, now: Math.round(colour.value * 100) }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={event => {
      if (event.nativeEvent.actionName === 'increment') onChange(Math.min(1, colour.value + 0.01));
      if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(0, colour.value - 0.01));
    }}>
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 300 44" preserveAspectRatio="none">
        <Defs><LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#000000" /><Stop offset="100%" stopColor={hsvToHex({ ...colour, value: 1 })} />
        </LinearGradient></Defs>
        <Rect x={8} y={10} width={284} height={24} rx={6} fill={`url(#${gradientId})`} stroke={theme.line} />
        <Circle cx={8 + colour.value * 284} cy={22} r={8} fill={hsvToHex(colour)} stroke="#FFFFFF" strokeWidth={3} />
        <Circle cx={8 + colour.value * 284} cy={22} r={10} fill="none" stroke={theme.ink} strokeWidth={1.5} />
      </Svg>
    </View>
  </View></SwipeGuard>;
}

// Suppress browser scrolling only inside the two drag controls; native uses the responder.
const webDragStyle: ViewStyle & { touchAction?: 'none' } = Platform.OS === 'web' ? { touchAction: 'none' } : {};
const styles = StyleSheet.create({
  wheel: { width: '100%', maxWidth: 300, aspectRatio: 1, alignSelf: 'center' },
  brightness: { width: '100%', height: 44 },
});
