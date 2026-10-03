import { useState } from 'react';
import { Text } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { PatternTable } from '../components/PatternTable';
import { Sheet } from '../components/Sheet';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import type { Argonaut } from '../domain/party';
import type { PatternKind } from '../domain/pattern-table';
import { overrideKey, resolveTable } from '../domain/references';
import { ReferencePicker } from '../references/ReferencePicker';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';

export function ReferenceDialog({ kind, argonaut, onClose }: { kind: PatternKind; argonaut: Argonaut; onClose: () => void }) {
  const [choosing, setChoosing] = useState(false), { dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers();
  const [removing, setRemoving] = useState(false);
  const resolved = resolveTable(argonaut, kind, catalogue), override = argonaut.tableOverrides[overrideKey(kind)];
  const card = resolved.face && catalogue.get((override || argonaut.titan)!.definitionId);
  const hidden = card && spoilers.hidden(card);
  if (removing && override) return <RemovalConfirmation subject={hidden ? 'the unrevealed Pattern override' : resolved.face?.name || 'the Pattern override'}
    detail="This removes the Pattern override and uses the Titan default." onCancel={() => setRemoving(false)}
    onConfirm={() => { dispatch({ type: 'table-override', argonautId: argonaut.id, kind, reference: null }); setRemoving(false); }} />;
  if (choosing) return <ReferencePicker family="Pattern" tableKind={kind} selected={override} onClose={() => setChoosing(false)} onSelect={reference => {
    dispatch({ type: 'table-override', argonautId: argonaut.id, kind, reference }); setChoosing(false);
  }} />;
  return <Sheet wide visible title={`${kind} reference`} subtitle={hidden ? 'Unrevealed card' : resolved.face?.name || 'Reference unavailable'} onClose={onClose}>
    <Text style={{ color: theme.muted, fontSize: 13 }}>{override ? 'Pattern override' : 'Titan default'}</Text>
    {resolved.message ? <Text style={{ color: theme.danger, lineHeight: 22 }}>{resolved.message}</Text>
      : resolved.source === 'pattern' || hidden ? card && resolved.face && <ReferenceCard card={card} face={resolved.face} />
        : <PatternTable kind={kind} table={resolved.table} />}
    <Button label={override ? 'Change Pattern override' : 'Choose Pattern override'} onPress={() => setChoosing(true)} />
    {override && <Button quiet label="Use Titan default" onPress={() => setRemoving(true)} />}
  </Sheet>;
}
