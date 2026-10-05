import { CardSelectionTarget } from './CardSelectionTarget';
import { StyleSheet, Text, View } from 'react-native';
import type { CardDefinition, CardFace } from '../../domain/cards';
import { useSpoilers } from '../../state/SpoilerProvider';
import { theme } from '../../theme/tokens';
import { GearCard } from './GearCard';
import { SecretCard } from './SecretCard';

/** The same card grid serves catalogue browsing and slot-filtered equipment selection. */
export function GearResults({ cards, width, faceForCard, onSelect, selecting = false }: {
  cards: CardDefinition[]; width: number; faceForCard: (card: CardDefinition) => CardFace;
  onSelect: (card: CardDefinition, face: CardFace) => void; selecting?: boolean;
}) {
  const spoilers = useSpoilers();
  return <View style={styles.grid}>{cards.map(card => {
    const face = faceForCard(card), hidden = spoilers.hidden(card);
    return <View key={card.id} style={[styles.item, { width }]}>
      <CardSelectionTarget label={`${selecting ? 'Select' : 'Open'} ${hidden ? 'unrevealed card' : face.name}`}
        hint={selecting ? 'Shows this card for review before equipping' : 'Opens the full card view'}
        onPress={() => onSelect(card, face)} style={({ pressed }) => pressed && styles.pressed}>
        {hidden ? <SecretCard card={card} /> : face.kind === 'gear' && <GearCard face={face} width={width} preview />}
      </CardSelectionTarget>
      {!hidden && <Text style={styles.details}>{face.cycle}{face.kind === 'gear' ? ` · ${[face.data.slot, ...face.data.traits].join(' · ')}` : ''}</Text>}
    </View>;
  })}</View>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 32 },
  item: { maxWidth: '100%', gap: 8 }, pressed: { opacity: 0.7 }, details: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
