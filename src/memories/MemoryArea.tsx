import { router } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { SwipeGuard } from '../components/SwipeSurface';
import { SectionHeading } from '../dashboard/EquipmentArea';
import { loadoutState } from '../domain/loadout';
import { canDiscardMemory, canExhaustMemory, fatedGrowthAvailable, memoryAt, memoryConflict, memoryFamily, memoryKey, memoryProgress } from '../domain/memories';
import { fatedMemorySide } from '../domain/memory-presentation';
import type { MemoryKind } from '../domain/memories';
import type { Argonaut } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { NodeTracker } from './NodeTracker';

export function MemoryArea({ argonaut }: { argonaut: Argonaut }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers();
  const positions = loadoutState(argonaut, catalogue).positions;
  return <View style={styles.area}>
    <SectionHeading title="Memories" />
    <View style={styles.groups}>
    {(['mnemos', 'fated-mnemos'] as const).map(kind => {
      const capacity = positions.filter(position => position.kind === kind).length;
      const count = Math.max(capacity, argonaut[memoryKey(kind)].length);
      return <MemoryGroup key={kind} count={count}>{cellWidth => Array.from({ length: count }, (_, index) => {
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
            {card && face ? <ReferenceCard card={card} face={face} exhausted={Boolean(item?.exhausted || item?.discarded)} revealable={false} memoryProgress={progress} />
              : <View style={styles.empty}><Text style={styles.hint}>{item ? 'Saved card unavailable. Select to replace or remove.' : 'Select a memory'}</Text></View>}
          </Pressable></SwipeGuard>
          {index >= capacity && item && <Text style={styles.warning}>Outside current capacity. Progress is kept.</Text>}
          {conflict && <Text style={styles.warning}>Also assigned to {conflict.argonautName || 'Argonaut'}. Remove one copy.</Text>}
          {item && <>
            <NodeTracker argonautId={argonaut.id} instance={item} label={label} kind={kind} />
            {!hidden && progress && kind === 'fated-mnemos' && <Text style={styles.hint}>{fatedGrowthAvailable(progress) ? 'Resolved · Growth side' : 'Unresolved · Front side'}</Text>}
            {(item.discarded || item.exhausted) && <Text style={styles.hint}>{item.discarded ? 'Discarded' : 'Exhausted'}</Text>}
            <CardActionRow>{!item.discarded && (item.exhausted || !hidden && canExhaustMemory(face, memoryProgress(item))) && <CardActionButton action={item.exhausted ? 'Ready' : 'Exhaust'} cardName={actionName} onPress={() => dispatch({ type: 'memory-state', argonautId: argonaut.id, instanceId: item.id, exhausted: !item.exhausted })} />}
              {(item.discarded || !hidden && canDiscardMemory(face, memoryProgress(item))) && <CardActionButton action={item.discarded ? 'Restore' : 'Discard'} cardName={actionName} onPress={() => dispatch({ type: 'memory-state', argonautId: argonaut.id, instanceId: item.id, discarded: !item.discarded })} />}
              {otherFace && !hidden && <CardActionButton action="Flip" cardName={actionName} onPress={() => dispatch({ type: 'memory-state', argonautId: argonaut.id, instanceId: item.id, faceId: otherFace.id })} />}
            </CardActionRow>
          </>}
        </View>;
      })}</MemoryGroup>;
    })}
    </View>
  </View>;
}
function MemoryGroup({ count, children }: { count: number; children: (cellWidth: number) => ReactNode }) {
  const [width, setWidth] = useState(412);
  const columns = Math.min(Math.max(1, count), Math.max(1, Math.floor((width + 12) / 212)));
  const cellWidth = Math.min(262, (width - (columns - 1) * 12) / columns);
  return <View onLayout={event => { if (event.nativeEvent.layout.width > 0) setWidth(event.nativeEvent.layout.width); }} style={[styles.row, {
    flexBasis: Math.max(1, count) * 200 + Math.max(0, count - 1) * 12,
    flexGrow: Math.max(1, count), maxWidth: Math.max(1, count) * 262 + Math.max(0, count - 1) * 12,
  }]}>{children(cellWidth)}</View>;
}
const styles = StyleSheet.create({
  area: { gap: 12, minWidth: 0 }, groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', flexShrink: 1, minWidth: 0 },
  cell: { padding: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, borderRadius: 6, gap: 8 },
  cardTarget: { gap: 10 },
  label: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  empty: { minHeight: 110, alignItems: 'center', justifyContent: 'center', padding: 12 }, hint: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  warning: { color: theme.danger, fontSize: 12, lineHeight: 18 },
});
