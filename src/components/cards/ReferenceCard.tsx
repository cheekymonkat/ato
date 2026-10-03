import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CardDefinition, CardFace } from '../../domain/cards';
import type { MemoryProgress } from '../../domain/party';
import { displayValue, strings } from '../../domain/card-presentation';
import { faceTable, flattenAbilities } from '../../domain/references';
import { useSpoilers } from '../../state/SpoilerProvider';
import { cycleColour, gearTheme as g } from '../../theme/gear-tokens';
import { PatternTable } from '../PatternTable';
import { CardColours, useCardColours } from './CardColours';
import { RichParagraph } from './RichParagraph';
import { SecretCard } from './SecretCard';
import { MemoryCard } from './MemoryCard';
import { TitanCardBody } from './TitanCard';
import { ConditionCard } from './ConditionCard';
import { conditionEffects, supportsCondition } from '../../domain/conditions';

/** Full-height presentations share rich text and the ATCC-style table renderer. */
export function ReferenceCard({ card, face, exhausted = false, showTables = true, revealable = true, memoryProgress, titanHeaderActions, onSelectTitan }: {
  card: CardDefinition; face: CardFace; exhausted?: boolean; showTables?: boolean; revealable?: boolean; memoryProgress?: MemoryProgress;
  titanHeaderActions?: ReactNode; onSelectTitan?: () => void;
}) {
  const spoilers = useSpoilers();
  return spoilers.hidden(card) ? <SecretCard card={card} compact onReveal={revealable ? () => spoilers.reveal(card.id) : undefined} />
    : <CardColours exhausted={exhausted}>{face.kind === 'mnemos' || face.kind === 'fated-mnemos'
      ? <MemoryCard face={face} progress={memoryProgress} /> : face.family === 'Condition' ? <ConditionCard face={face} /> : <ReferenceFace face={face} showTables={showTables} titanHeaderActions={titanHeaderActions} onSelectTitan={onSelectTitan} />}</CardColours>;
}
function ReferenceFace({ face, showTables, titanHeaderActions, onSelectTitan }: { face: Exclude<CardFace, { kind: 'mnemos' | 'fated-mnemos' }>; showTables: boolean; titanHeaderActions?: ReactNode; onSelectTitan?: () => void }) {
  const paint = useCardColours(), data = face.data, colour = paint.colour(cycleColour(face.cycle));
  const ink = paint.colour(colour === '#FFFFFF' ? '#000000' : colour);
  return <View testID={`reference-card-${face.id}`} style={[styles.card, { backgroundColor: paint.colour(g.papyrus), borderColor: paint.colour(g.papyrusDark) }]}>
    <View style={styles.body}>
      {face.kind === 'titan' ? <TitanCardBody face={face} ink={ink} headerActions={titanHeaderActions} onSelect={onSelectTitan} /> : <>
      <Text style={[styles.meta, { color: ink }]}>{face.family} · {face.cycle}</Text>
      <Text accessibilityRole="header" style={[styles.name, { color: ink }]}>{face.name}</Text>
      {Boolean(data.subtitle) && <Text style={styles.subtitle}>{displayValue(data.subtitle)}</Text>}
      {strings(data.traits).length > 0 && <Text style={styles.meta}>{strings(data.traits).join(' · ')}</Text>}
      {Boolean(data.flavor) && <Text style={styles.flavor}>{displayValue(data.flavor)}</Text>}
      {data.abilities != null && <RichParagraph paragraph={flattenAbilities(data.abilities)} inlineGates size={14} align="left" />}
      {supportsCondition(face) && <RichParagraph paragraph={conditionEffects(face)} inlineGates size={14} align="left" />}
      </>}
      {showTables && (['Trauma', 'Kratos'] as const).map(kind => {
        const table = faceTable(face, kind);
        return table && <PatternTable key={kind} kind={kind} table={table} />;
      })}
    </View>
    {face.kind === 'titan' && onSelectTitan ? <Pressable accessibilityRole="button" accessibilityLabel="Edit selected Titan" onPress={onSelectTitan} style={[styles.footer, { backgroundColor: colour }]}>
      <Text style={[styles.ids, { color: colour === '#FFFFFF' ? '#000000' : '#FFFFFF' }]}>ID(s): {face.printedIds.join(', ') || 'Not supplied'}</Text>
    </Pressable> : <View style={[styles.footer, { backgroundColor: colour }]}><Text style={[styles.ids, { color: colour === '#FFFFFF' ? '#000000' : '#FFFFFF' }]}>ID(s): {face.printedIds.join(', ') || 'Not supplied'}</Text></View>}
  </View>;
}
const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: 9, overflow: 'hidden', borderWidth: 1 }, body: { padding: 12, gap: 12 },
  name: { fontSize: 19, lineHeight: 27, textAlign: 'center' }, meta: { fontSize: 11, lineHeight: 17, textAlign: 'center', color: '#000000' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#000000' }, flavor: { fontSize: 13, lineHeight: 20, fontStyle: 'italic', textAlign: 'center', color: '#000000' },
  footer: { padding: 10 }, ids: { fontSize: 11, lineHeight: 17 },
});
