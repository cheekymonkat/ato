import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { SwipeGuard } from '../components/SwipeSurface';
import { argonautSuggestions, portraitSkill, resolveArgonautChange, sameArgonautIdentity } from '../domain/argonaut-identity';
import { campaignCycle } from '../domain/campaign';
import type { Argonaut } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import type { ArgonautChange } from '../domain/argonaut-identity';
import { ArgonautChangeConfirmation } from './ArgonautChangeConfirmation';
import { theme } from '../theme/tokens';

export function ArgonautName({ argonaut, number }: { argonaut: Argonaut; number: number }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue();
  const input = useRef<TextInput>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState<(ArgonautChange & { partyId: string; expectedName: string; expectedDefinitionId: string | null }) | null>(null);
  const name = draft ?? argonaut.name;
  const matches = draft !== null ? argonautSuggestions(catalogue, name, campaignCycle(party)) : [];
  const portrait = argonaut.argonautDefinitionId ? catalogue.getFace(argonaut.argonautDefinitionId, 'front') : undefined;
  const skill = portraitSkill(portrait);
  function choose(change: ArgonautChange) {
    const next = resolveArgonautChange(change, campaignCycle(party), catalogue);
    if (!next) return;
    input.current?.blur();
    if (sameArgonautIdentity(argonaut, next)) { setDraft(null); return; }
    setPending({ ...next, partyId: party.id, expectedName: argonaut.name, expectedDefinitionId: argonaut.argonautDefinitionId });
  }
  const cancel = () => { input.current?.blur(); setPending(null); setDraft(null); };
  return <View>
    <SwipeGuard><TextInput ref={input} accessibilityLabel="Argonaut name" accessibilityHint="Type a name, then select a suggested Argonaut or use a custom name. Changing Argonauts requires confirmation, resets stats and clears memories, conditions and tokens."
      placeholder={`Argonaut ${number}`} maxLength={60} selectTextOnFocus autoCorrect={false}
      value={name} onChangeText={setDraft} onSubmitEditing={() => {
        if (name.trim() === argonaut.name) setDraft(null);
        else if (draft !== null) choose({ name, definitionId: null });
      }} style={styles.input} /></SwipeGuard>
    {draft !== null && !pending && <View style={styles.suggestions}>
      <Text accessibilityLiveRegion="polite" style={styles.detail}>{matches.length ? 'Select an Argonaut to apply their skill bonus.' : 'No matching Argonauts in this campaign cycle.'}</Text>
      {matches.slice(0, 5).map(match => <Button key={match.definitionId} quiet
        label={`Select ${match.name}: +1 ${match.skill}, ${match.cycle}`} style={styles.suggestion} onPress={() => {
          choose({ name: match.name, definitionId: match.definitionId });
        }}>
        <Text style={styles.name}>{match.name}</Text><Text style={styles.detail}>+1 {match.skill} · {match.cycle}</Text>
      </Button>)}
      {matches.length > 5 && <Text style={styles.detail}>Type more to narrow the suggestions.</Text>}
      <Button quiet label={`Use custom name ${name}`} disabled={!name.trim()} onPress={() => choose({ name, definitionId: null })}><Text style={styles.detail}>Use this custom name</Text></Button>
      <Button quiet label="Cancel name edit" onPress={cancel}><Text style={styles.detail}>Cancel</Text></Button>
    </View>}
    {skill && <Text style={styles.detail}>Portrait bonus: +1 {skill}</Text>}
    {pending && <ArgonautChangeConfirmation currentName={pending.expectedName} nextName={pending.name}
      skill={pending.definitionId ? portraitSkill(catalogue.getFace(pending.definitionId, 'front')) : null} onCancel={cancel} onConfirm={() => {
        dispatch({ type: 'argonaut-change', argonautId: argonaut.id, ...pending, confirmed: true }); setPending(null); setDraft(null);
      }} />}
  </View>;
}
const styles = StyleSheet.create({
  input: { fontFamily: theme.serif, color: theme.ink, fontSize: 32, minHeight: 52, paddingVertical: 4, marginTop: 8, borderBottomWidth: 1, borderBottomColor: theme.line },
  suggestions: { padding: 8, gap: 6, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 5, marginTop: 6 },
  suggestion: { alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 8 },
  name: { color: theme.ink, fontSize: 14, fontWeight: '600' },
  detail: { color: theme.muted, fontSize: 12, lineHeight: 18 },
});
