import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { SwipeGuard } from '../components/SwipeSurface';
import { SectionHeading } from '../dashboard/EquipmentArea';
import { loadoutState } from '../domain/loadout';
import { canDiscardMemory, fatedGrowthAvailable, memoryAt, memoryConflict, memoryFamily, memoryKey, memoryProgress } from '../domain/memories';
import { fatedMemorySide } from '../domain/memory-presentation';
import type { MemoryKind } from '../domain/memories';
import type { Argonaut } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { NodeTracker } from './NodeTracker';
import { MEMORY_GAP, memoryCardSize, memoryGroupWidths } from './memory-layout';

export function MemoryArea({ argonaut }: { argonaut: Argonaut }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers();
  const { width } = useWindowDimensions();
  const [areaWidth, setAreaWidth] = useState(width - 32);
  const positions = loadoutState(argonaut, catalogue).positions;
  const groups = (['mnemos', 'fated-mnemos'] as const).map(kind => {
    const capacity = positions.filter(position => position.kind === kind).length;
    return { kind, capacity, count: Math.max(capacity, argonaut[memoryKey(kind)].length) };
  });
  const groupWidths = memoryGroupWidths(areaWidth, groups.map(group => group.count));
  return <View style={styles.area}>
    <SectionHeading title="Memories" />
    <View style={styles.groups} onLayout={event => { if (event.nativeEvent.layout.width > 0) setAreaWidth(event.nativeEvent.layout.width); }}>
    {groups.map(({ kind, capacity, count }, groupIndex) => {
      const groupWidth = groupWidths[groupIndex], { width: cellWidth } = memoryCardSize(groupWidth, count);
      return <View key={kind} style={[styles.row, { width: groupWidth }]}>{Array.from({ length: count }, (_, index) => {
        const item = memoryAt(argonaut, kind, index), card = item && catalogue.get(item.definitionId), face = item && catalogue.getFace(item.definitionId, item.faceId);
        const hidden = card && spoilers.hidden(card), progress = item && memoryProgress(item);
        const visibleName = face?.kind === 'fated-mnemos' ? fatedMemorySide(face, progress).name : face?.name;
        const actionName = hidden ? 'unrevealed card' : visibleName || 'card';
        const otherFace = card?.faces.find(side => side.id !== item?.faceId && side.kind === kind);
        const label = `${memoryFamily(kind)} ${index + 1}`;
        const conflict = item && memoryConflict(party, item.definitionId, { argonautId: argonaut.id, kind, index });
        const open = (kind: MemoryKind) => router.push({ pathname: '/memory/[id]', params: { id: argonaut.id, kind, index: String(index) } });
        return <View key={`${kind}:${index}`} style={[styles.cell, { width: cellWidth, maxWidth: '100%' }]}>
          <SwipeGuard><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}${!hidden && visibleName ? `: ${visibleName}` : ''}`}
            onPress={() => open(kind)} style={({ pressed }) => [styles.cardTarget, pressed && { opacity: 0.75 }]}>
            <Text style={styles.label}>{label}</Text>
            {card && face ? <ReferenceCard card={card} face={face} exhausted={Boolean(item?.discarded)} revealable={false} memoryProgress={progress} instance={item} onAbilityExhausted={item ? (abilityId, exhausted) => dispatch({ type: 'ability-exhausted', argonautId: argonaut.id, instanceId: item.id, definitionId: item.definitionId, faceId: item.faceId, abilityId, exhausted }) : undefined} />
              : <View style={styles.empty}><Text style={styles.hint}>{item ? 'Saved card unavailable. Select to replace or remove.' : 'Select a memory'}</Text></View>}
          </Pressable></SwipeGuard>
          {index >= capacity && item && <Text style={styles.warning}>Outside current capacity. Progress is kept.</Text>}
          {conflict && <Text style={styles.warning}>Also assigned to {conflict.argonautName || 'Argonaut'}. Remove one copy.</Text>}
          {item && <>
            <NodeTracker argonautId={argonaut.id} instance={item} label={label} kind={kind} />
            {!hidden && progress && kind === 'fated-mnemos' && <Text style={styles.hint}>{fatedGrowthAvailable(progress) ? 'Resolved · Growth side' : 'Unresolved · Front side'}</Text>}
            {item.discarded && <Text style={styles.hint}>Discarded</Text>}
            <CardActionRow>{(item.discarded || !hidden && canDiscardMemory(face, memoryProgress(item))) && <CardActionButton action={item.discarded ? 'Restore' : 'Discard'} cardName={actionName} onPress={() => dispatch({ type: 'memory-state', argonautId: argonaut.id, instanceId: item.id, discarded: !item.discarded })} />}
              {otherFace && !hidden && <CardActionButton action="Flip" cardName={actionName} onPress={() => dispatch({ type: 'memory-state', argonautId: argonaut.id, instanceId: item.id, faceId: otherFace.id })} />}
            </CardActionRow>
          </>}
        </View>;
      })}</View>;
    })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  area: { gap: 12, minWidth: 0 }, groups: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: MEMORY_GAP, alignItems: 'flex-start' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: MEMORY_GAP, alignItems: 'flex-start', flexShrink: 0, minWidth: 0, maxWidth: '100%' },
  cell: { flexShrink: 0, minWidth: 0, padding: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, borderRadius: 6, gap: 8 },
  cardTarget: { gap: 10 },
  label: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  empty: { minHeight: 110, alignItems: 'center', justifyContent: 'center', padding: 12 }, hint: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  warning: { color: theme.danger, fontSize: 12, lineHeight: 18 },
});
