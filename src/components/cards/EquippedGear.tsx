import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CardDefinition, CardFace } from '../../domain/cards';
import { useSpoilers } from '../../state/SpoilerProvider';
import { theme } from '../../theme/tokens';
import { grayscaleColour } from '../../domain/card-colour';
import { GearCard } from './GearCard';
import { SecretCard } from './SecretCard';

/** Share the inspection renderer, allowing the entire face to grow with its text. */
export function EquippedGear({ card, face, exhausted = false }: { card: CardDefinition; face: Extract<CardFace, { kind: 'gear' }>; exhausted?: boolean }) {
  const spoilers = useSpoilers();
  const [width, setWidth] = useState(240);
  return <View style={styles.presentation} onLayout={event => setWidth(Math.min(240, event.nativeEvent.layout.width))}>
    {spoilers.hidden(card) ? <SecretCard card={card} compact /> : <>
      <Text style={[styles.details, exhausted && { color: grayscaleColour(theme.ink) }]}>{face.cycle} · {face.id === 'front' ? 'Front' : 'Back'}</Text>
      <GearCard face={face} width={width} exhausted={exhausted} />
      <Text style={[styles.details, exhausted && { color: grayscaleColour(theme.ink) }]}>{[face.data.slot, ...face.data.traits].join(' · ')}</Text>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  presentation: { width: '100%', alignItems: 'center', gap: 6, marginTop: 8 },
  details: { color: theme.ink, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
