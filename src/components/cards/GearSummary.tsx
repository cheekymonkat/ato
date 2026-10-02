import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CardDefinition, CardFace } from '../../domain/cards';
import { displayValue, formatParagraph } from '../../domain/card-presentation';
import { useSpoilers } from '../../state/SpoilerProvider';
import { cycleColour, gearTheme } from '../../theme/gear-tokens';
import { SwipeGuard } from '../SwipeSurface';
import { CardIcon } from './CardIcon';
import { SecretCard } from './SecretCard';

/** Readable slot summary; the full renderer is opened rather than scaled down to slot width. */
export function GearSummary({ card, face, onInspect }: { card: CardDefinition; face: Extract<CardFace, { kind: 'gear' }>; onInspect: () => void }) {
  const spoilers = useSpoilers();
  if (spoilers.hidden(card)) return <SecretCard card={card} compact onReveal={() => spoilers.reveal(card.id)} />;
  const colour = cycleColour(face.cycle), stats = face.data.offensiveStatistics;
  return <SwipeGuard><Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${face.name}`} onPress={onInspect}
    style={({ pressed }) => [styles.summary, { borderTopColor: colour }, pressed && { opacity: 0.7 }]}>
    <CardIcon name={face.data.slot} size={26} />
    <Text numberOfLines={3} style={styles.title}>{face.name}</Text>
    {Boolean(stats.attackDice || stats.precision) && <View style={styles.stats}>
      {Boolean(stats.attackDice) && <Text style={styles.stat}>{stats.attackDice} d10</Text>}{Boolean(stats.precision) && <Text style={styles.stat}>AT {stats.precision}</Text>}
    </View>}
    <Text numberOfLines={2} style={styles.ability}>{formatParagraph(face.data.abilities).label || displayValue(face.data.traits.join(' · '))}</Text>
    <Text style={styles.inspect}>Inspect card</Text>
  </Pressable></SwipeGuard>;
}
const styles = StyleSheet.create({
  summary: { minHeight: 140, paddingVertical: 12, paddingHorizontal: 8, marginTop: 10, borderTopWidth: 3, backgroundColor: gearTheme.papyrus, borderRadius: 4, gap: 8, alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '600', textAlign: 'center', color: '#000000' }, stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  stat: { fontSize: 12, color: '#000000' }, ability: { fontSize: 11, lineHeight: 16, textAlign: 'center', color: '#000000' }, inspect: { fontSize: 11, color: '#4D120B', textDecorationLine: 'underline' },
});
