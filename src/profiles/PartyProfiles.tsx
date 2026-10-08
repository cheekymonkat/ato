import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { campaignCycle, nextCampaignCycle } from '../domain/campaign';
import type { CampaignCycle } from '../domain/campaign';
import { CampaignCycleSelector } from './CampaignCycleSelector';
import { AdvanceCycleConfirmation } from './AdvanceCycleConfirmation';
import { InventorySettings } from './InventorySettings';
import { Button } from '../components/Button';
import { useParty } from '../state/PartyProvider';
import { downloadBackup, pickBackup } from '../storage/files';
import { SaveNotice } from '../storage/SaveNotice';
import { errorMessage } from '../storage/snapshots';
import { exportProfile, readBackup, referenceProblems } from '../storage/workspace';
import type { Workspace } from '../storage/workspace';
import { theme } from '../theme/tokens';

export function PartyProfiles() {
  const state = useParty();
  const scroll = useRef<ScrollView>(null);
  const cycle = campaignCycle(state.profile.party), nextCycle = nextCampaignCycle(cycle);
  const [advance, setAdvance] = useState<{ partyId: string; argonautId: string; expectedCycle: CampaignCycle } | null>(null);
  const [newCycle, setNewCycle] = useState<CampaignCycle>(1);
  const [newInventoryTracking, setNewInventoryTracking] = useState(false);
  const [name, setName] = useState(state.profile.name), [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<ReturnType<typeof readBackup> | null>(null), [importName, setImportName] = useState('');
  const [previous, setPrevious] = useState<Workspace | null>(null), [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false), [json, setJson] = useState('');
  const goToArgo = () => router.replace('/argo');
  const showError = (error: unknown) => { setError(errorMessage(error)); scroll.current?.scrollTo({ y: 0, animated: true }); };
  const act = (action: () => void) => { setError(null); setMessage(null); try { action(); } catch (error) { showError(error); } };
  const asyncAct = async (action: () => Promise<void>) => {
    setError(null); setMessage(null); setBusy(true);
    try { await action(); } catch (error) { showError(error); } finally { setBusy(false); }
  };
  const review = (text: string) => {
    setPending(null);
    const candidate = readBackup(text, getCatalogue());
    setPending(candidate); setImportName(`${candidate.profile.name.slice(0, 69)} (imported)`); setPrevious(null);
  };
  const problems = referenceProblems(state.profile.party, getCatalogue());
  const mismatch = state.profile.party.catalogueVersion !== getCatalogue().version;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Campaigns & backups</Text><Button quiet label="Return to Argo" disabled={busy} onPress={goToArgo} /></View>
      <SaveNotice />
      <Text style={styles.text}>Parties save automatically on this device. Export JSON backups to keep a separate copy or move a party to another device.</Text>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
      {(problems.length > 0 || mismatch) && <View style={styles.box}><Text style={styles.heading}>Catalogue notices</Text>
        {mismatch && <Text style={styles.text}>This party uses a different catalogue version. Slot capacity is recalculated using the installed catalogue.</Text>}
        {problems.map((problem, index) => <Text key={index} style={styles.error}>{problem}</Text>)}
        {!!problems.length && <Text style={styles.text}>All saved records have been retained. Export a backup before making changes to unresolved cards.</Text>}
        {mismatch && <>
          <Button quiet label="Acknowledge catalogue update" disabled={busy || state.preview || problems.length > 0} onPress={() => void asyncAct(async () => {
            state.acknowledgeCatalogue(state.profile.id, state.profile.party.catalogueVersion);
            await state.flush();
            setMessage('Catalogue update acknowledged. Your campaign progress is unchanged.');
          })} />
          {!!problems.length && <Text style={styles.detail}>Resolve the listed card issues to acknowledge this update.</Text>}
        </>}
      </View>}
      <View style={styles.box}><Text accessibilityRole="header" style={styles.heading}>Your parties</Text>
        {state.workspace.profiles.map(profile => <View key={profile.id} style={styles.profileRow}>
          <View style={{ flex: 1 }}><Text style={styles.text}>{profile.name}{profile.id === state.profile.id ? ' · Current' : ''}</Text>
            <Text style={styles.detail}>Cycle {campaignCycle(profile.party)} · {profile.party.order.map(id => profile.party.argonauts.find(member => member.id === id)!.name).join(' · ')}</Text></View>
          <Button quiet label={`Open ${profile.name}`} disabled={busy} onPress={() => act(() => { state.switchProfile(profile.id); goToArgo(); })}><Text style={styles.openLabel}>Open</Text></Button>
        </View>)}
      </View>
      <View style={styles.box}><Text accessibilityRole="header" style={styles.heading}>Current campaign configuration</Text>
        <TextInput accessibilityLabel="Party name" value={name} onChangeText={setName} maxLength={80} style={styles.input} />
        <Button quiet label="Rename current party" disabled={busy || !name.trim() || state.preview} onPress={() => act(() => state.renameProfile(name))} />
        <Text style={styles.text}>Current Cycle: {cycle}</Text>
        <Text style={styles.detail}>Applies to all four Argonauts. Cards from this cycle and earlier are available; token types follow this cycle too. You can advance one cycle at a time and cannot go back.</Text>
        <Button label="Advance cycle" disabled={busy || state.preview || nextCycle === null} onPress={() => setAdvance({ partyId: state.profile.id, argonautId: state.profile.party.activeArgonautId, expectedCycle: cycle })} />
        {nextCycle === null && <Text style={styles.detail}>Cycle 5 is the final cycle.</Text>}
        <InventorySettings label="Current campaign" enabled={state.profile.party.inventory?.enforce === true} disabled={busy || state.preview}
          onChange={enabled => act(() => {
            state.dispatch({ type: 'inventory-mode', partyId: state.profile.id, argonautId: state.profile.party.activeArgonautId, enabled });
            setMessage(`Campaign inventory tracking ${enabled ? 'enabled' : 'disabled'}.`);
          })} />
        <Text style={styles.detail}>Changing inventory tracking saves automatically and keeps your acquired records and existing loadouts.</Text>
      </View>
      <View style={styles.box}><Text accessibilityRole="header" style={styles.heading}>New campaign</Text>
        <TextInput accessibilityLabel="New party name" placeholder="Expedition name" value={newName} onChangeText={setNewName} maxLength={80} style={styles.input} />
        <Text style={styles.text}>Campaign cycle</Text>
        <CampaignCycleSelector label="New campaign" value={newCycle} onChange={setNewCycle} disabled={busy} />
        <InventorySettings label="New campaign" enabled={newInventoryTracking} onChange={setNewInventoryTracking} disabled={busy} />
        <Button label="Create campaign" disabled={busy || !newName.trim()} onPress={() => act(() => { state.createProfile(newName, newCycle, newInventoryTracking); goToArgo(); })} />
      </View>
      <View style={styles.box}><Text accessibilityRole="header" style={styles.heading}>Portable backup</Text>
        <View style={styles.actions}><Button label="Export party JSON" disabled={busy || state.preview} onPress={() => void asyncAct(async () => {
          const text = exportProfile(state.profile, state.workspace.adventureReplay);
          const filename = `ato-${state.profile.name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60)}-${Date.now()}.json`;
          await downloadBackup(text, filename); setMessage('Backup handed to your browser or device. Keep the JSON file somewhere safe.');
        })} />
          <Button quiet label="Import JSON file" disabled={busy} onPress={() => void asyncAct(async () => { setPending(null); const text = await pickBackup(); if (text !== null) review(text); })} />
          <Button quiet label={pasteOpen ? 'Close pasted JSON' : 'Paste backup JSON'} onPress={() => setPasteOpen(!pasteOpen)} /></View>
        <Text style={styles.detail}>Import validates the entire party and creates a new profile. Your current party is kept.</Text>
        {pasteOpen && <><TextInput accessibilityLabel="Backup JSON" multiline value={json} onChangeText={setJson} style={[styles.input, styles.json]} />
          <Button quiet label="Validate pasted backup" disabled={busy || !json.trim()} onPress={() => act(() => review(json))} /></>}
        {pending && <View style={styles.review}><Text style={styles.heading}>Review import</Text>
          <Text style={styles.detail}>Campaign cycle: {campaignCycle(pending.profile.party)}</Text>
          <Text style={styles.text}>{pending.profile.party.argonauts.map(member => `${member.name}: ${member.instances.length} cards${member.titan ? ' + Titan' : ''}`).join('\n')}</Text>
          {pending.warnings.map(warning => <Text key={warning} style={styles.text}>{warning}</Text>)}
          <TextInput accessibilityLabel="Imported party name" value={importName} onChangeText={setImportName} maxLength={80} style={styles.input} />
          <View style={styles.actions}><Button label="Import as new profile" disabled={busy || !importName.trim()} onPress={() => act(() => { state.addImport(pending.profile, importName, pending.adventureReplay); goToArgo(); })} />
            <Button quiet label="Cancel import" onPress={() => setPending(null)} /></View>
        </View>}
      </View>
      <View style={styles.box}><Text accessibilityRole="header" style={styles.heading}>Previous snapshot</Text>
        <Text style={styles.text}>One previous successful local save is kept for recovery. Restoring it changes all profiles and the active party. Export your current party first if you want to keep both.</Text>
        <Button quiet label="Review previous snapshot" disabled={busy || state.preview} onPress={() => void asyncAct(async () => {
          await state.flush(); const snapshot = await state.previousSnapshot(); setPrevious(snapshot); setPending(null);
          if (!snapshot) setMessage('No readable previous snapshot is available yet.');
        })} />
        {previous && <View style={styles.review}><Text style={styles.text}>Restore {previous.profiles.length} {previous.profiles.length === 1 ? 'party' : 'parties'}: {previous.profiles.map(profile => profile.name).join(', ')}</Text>
          <View style={styles.actions}><Button label="Restore this snapshot" disabled={busy} onPress={() => void asyncAct(async () => { await state.restoreSnapshot(previous); goToArgo(); })} />
            <Button quiet label="Keep current save" onPress={() => setPrevious(null)} /></View></View>}
      </View>
    </ScrollView>
    {advance && advance.partyId === state.profile.id && advance.expectedCycle === cycle && <AdvanceCycleConfirmation key={`${advance.partyId}:${advance.expectedCycle}`}
      campaignName={state.profile.name} cycle={advance.expectedCycle} disabled={busy || state.preview} onCancel={() => setAdvance(null)}
      onConfirm={() => act(() => {
        if (busy || state.preview || advance.partyId !== state.profile.id || advance.expectedCycle !== campaignCycle(state.profile.party)) return;
        state.dispatch({ type: 'advance-cycle', ...advance, confirmed: true }); setAdvance(null); setMessage(`Campaign advanced to Cycle ${nextCycle}.`);
      })} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas }, scroll: { padding: 20, gap: 16, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: theme.serif, fontSize: 28, color: theme.ink }, heading: { fontFamily: theme.serif, fontSize: 21, color: theme.ink },
  text: { color: theme.ink, fontSize: 15, lineHeight: 22 }, detail: { color: theme.muted, fontSize: 13, lineHeight: 19 }, error: { color: theme.danger, fontSize: 14, lineHeight: 21 },
  box: { padding: 16, borderWidth: 1, borderColor: theme.line, borderRadius: 6, backgroundColor: theme.paper, gap: 12 },
  input: { borderWidth: 1, borderColor: theme.line, padding: 12, minHeight: 44, borderRadius: 4, backgroundColor: theme.white, color: theme.ink, fontSize: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: theme.line },
  review: { paddingTop: 12, borderTopWidth: 1, borderColor: theme.line, gap: 12 }, json: { minHeight: 150, textAlignVertical: 'top', fontSize: 13 },
  openLabel: { color: theme.ink, fontWeight: '600', fontSize: 14 },
});
