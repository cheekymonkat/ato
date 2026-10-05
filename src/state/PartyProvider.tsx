import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import type { CampaignCycle } from '../domain/campaign';
import type { Party } from '../domain/party';
import { localStorageAdapter } from '../storage/adapter';
import { errorMessage, SnapshotStore } from '../storage/snapshots';
import type { LoadResult } from '../storage/snapshots';
import { acknowledgeCatalogueUpdate, importProfile, newProfile, profileName } from '../storage/workspace';
import type { PartyProfile, Workspace } from '../storage/workspace';
import { theme } from '../theme/tokens';
import { partyReducer } from './party-reducer';
import type { PartyAction } from './party-reducer';

type SaveStatus = 'saving' | 'saved' | 'error';
interface PartyContextValue {
  party: Party; dispatch: Dispatch<PartyAction>; workspace: Workspace; profile: PartyProfile;
  saveStatus: SaveStatus; saveError: string | null; preview: boolean;
  flush: () => Promise<void>; switchProfile: (id: string) => void;
  createProfile: (name: string, cycle: CampaignCycle) => string; renameProfile: (name: string) => void;
  acknowledgeCatalogue: (profileId: string, expectedVersion: string) => void;
  addImport: (profile: PartyProfile, name: string) => string;
  previousSnapshot: () => Promise<Workspace | null>; restoreSnapshot: (snapshot: Workspace) => Promise<void>;
  exitPreview: () => void;
}
const PartyContext = createContext<PartyContextValue | null>(null);
const uniqueId = () => `party-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const freshWorkspace = (): Workspace => {
  const profile = newProfile(uniqueId(), 'My expedition', getCatalogue().version);
  return { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] };
};

export function PartyProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new SnapshotStore(localStorageAdapter));
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const [recovery, setRecovery] = useState<Extract<LoadResult, { kind: 'recovery' }> | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saving');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewParty, setPreviewParty] = useState<Party | null>(null);
  const [restoring, setRestoring] = useState(false);
  const restoringRef = useRef(false);
  const previewRef = useRef<Party | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true), loadSequence = useRef(0);
  const update = useCallback((next: Workspace) => {
    workspaceRef.current = next; setWorkspace(next); setSaveStatus('saving');
  }, []);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const result = await store.load();
    if (!alive.current || sequence !== loadSequence.current) return;
    setRecovery(null);
    if (result.kind === 'recovery') setRecovery(result);
    else update(result.kind === 'ready' ? result.workspace : freshWorkspace());
  }, [store, update]);
  const cancelLoad = useCallback(() => { alive.current = false; loadSequence.current++; if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    // Hydration sets state only after awaiting the external storage read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    alive.current = true; void load();
    return cancelLoad;
  }, [load, cancelLoad]);
  const persist = useCallback(async (snapshot: Workspace) => {
    if (alive.current) { setSaveStatus('saving'); setSaveError(null); }
    try {
      await store.save(snapshot);
      if (alive.current && workspaceRef.current === snapshot) { setSaveStatus('saved'); setSaveError(null); }
    } catch (error) {
      if (alive.current && workspaceRef.current === snapshot) { setSaveStatus('error'); setSaveError(errorMessage(error)); }
      throw error;
    }
  }, [store]);
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (previewRef.current) throw new Error('This development preview is temporary. Leave the preview to use saved profiles.');
    if (workspaceRef.current) await persist(workspaceRef.current);
  }, [persist]);
  useEffect(() => {
    if (!workspace || recovery || previewParty) return;
    timer.current = setTimeout(() => { timer.current = null; void flush().catch(() => {}); }, 250);
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [workspace, recovery, previewParty, flush]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' && !previewRef.current) void flush().catch(() => {});
    });
    return () => subscription.remove();
  }, [flush]);
  const exitPreview = useCallback(() => { previewRef.current = null; setPreviewParty(null); }, []);
  const dispatch = useCallback((action: PartyAction) => {
    const current = workspaceRef.current;
    if (!current) return;
    const profile = current.profiles.find(profile => profile.id === current.activeProfileId)!;
    const party = previewRef.current || profile.party, next = partyReducer(party, action, getCatalogue());
    if (action.type === 'preview-loadout' || previewRef.current) {
      if (!previewRef.current) {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        void persist(current).catch(() => {});
      }
      previewRef.current = next; setPreviewParty(next); return;
    }
    if (next !== party) {
      update({ ...current, profiles: current.profiles.map(entry => entry.id === profile.id ? { ...entry, party: next } : entry) });
    }
  }, [update, persist]);
  const switchProfile = useCallback((id: string) => {
    const current = workspaceRef.current!;
    if (!current.profiles.some(profile => profile.id === id)) throw new Error('Profile no longer exists.');
    exitPreview(); update({ ...current, activeProfileId: id });
  }, [exitPreview, update]);
  const createProfile = useCallback((name: string, cycle: CampaignCycle) => {
    const current = workspaceRef.current!, profile = newProfile(uniqueId(), name, getCatalogue().version, cycle);
    exitPreview(); update({ ...current, activeProfileId: profile.id, profiles: [...current.profiles, profile] });
    return profile.party.activeArgonautId;
  }, [exitPreview, update]);
  const renameProfile = useCallback((name: string) => {
    const current = workspaceRef.current!, validName = profileName(name);
    update({ ...current, profiles: current.profiles.map(profile => profile.id === current.activeProfileId ? { ...profile, name: validName } : profile) });
  }, [update]);
  const acknowledgeCatalogue = useCallback((profileId: string, expectedVersion: string) => {
    if (previewRef.current) throw new Error('Leave the temporary preview before acknowledging catalogue notices.');
    const current = workspaceRef.current!;
    const next = acknowledgeCatalogueUpdate(current, profileId, expectedVersion, getCatalogue());
    if (next !== current) update(next);
  }, [update]);
  const addImport = useCallback((source: PartyProfile, name: string) => {
    const next = importProfile(workspaceRef.current!, source, uniqueId(), name);
    exitPreview(); update(next);
    return next.profiles.find(profile => profile.id === next.activeProfileId)!.party.activeArgonautId;
  }, [exitPreview, update]);
  const restoreSnapshot = useCallback(async (snapshot: Workspace) => {
    if (restoringRef.current) throw new Error('A snapshot restore is already in progress.');
    restoringRef.current = true; setRestoring(true);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      await store.save(snapshot);
      exitPreview(); update(snapshot); setRecovery(null); setSaveStatus('saved'); setSaveError(null);
    } finally { restoringRef.current = false; if (alive.current) setRestoring(false); }
  }, [store, exitPreview, update]);
  if (recovery) return <View style={styles.gate}>
    <Text accessibilityRole="header" style={styles.title}>Your save needs attention</Text>
    <Text style={styles.text}>{recovery.message}</Text>
    <Text style={styles.text}>Your stored data has been kept. Retry loading, or explicitly restore the previous snapshot.</Text>
    {saveError && <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>}
    <Button label="Retry loading" disabled={restoring} onPress={() => { setSaveError(null); void load(); }} />
    {recovery.previous && <Button label="Restore previous snapshot" disabled={restoring} onPress={() => void restoreSnapshot(recovery.previous!).catch(error => setSaveError(errorMessage(error)))} />}
    <Button quiet label="Start a new party instead" disabled={restoring} onPress={() => void restoreSnapshot(freshWorkspace()).catch(error => setSaveError(errorMessage(error)))} />
  </View>;
  if (!workspace) return <View style={styles.gate}><Text style={styles.text}>Loading your party…</Text></View>;
  const profile = workspace.profiles.find(profile => profile.id === workspace.activeProfileId)!;
  const value: PartyContextValue = { party: previewParty || profile.party, dispatch, workspace, profile, saveStatus, saveError, preview: !!previewParty,
    flush, switchProfile, createProfile, renameProfile, acknowledgeCatalogue, addImport, previousSnapshot: () => store.previous(), restoreSnapshot, exitPreview };
  return <PartyContext.Provider value={value}>{children}
    <Modal transparent visible={restoring} onRequestClose={() => {}}>
      <View style={styles.restoring}><View style={styles.restorePanel}><Text accessibilityLiveRegion="polite" style={styles.text}>Restoring your save…</Text></View></View>
    </Modal>
  </PartyContext.Provider>;
}

export function useParty() {
  const context = useContext(PartyContext);
  if (!context) throw new Error('PartyProvider is missing');
  return context;
}
const styles = StyleSheet.create({
  gate: { flex: 1, backgroundColor: theme.canvas, padding: 32, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { color: theme.ink, fontFamily: theme.serif, fontSize: 26 }, text: { color: theme.ink, maxWidth: 560 }, error: { color: theme.danger },
  restoring: { flex: 1, backgroundColor: '#29272340', justifyContent: 'center', alignItems: 'center' }, restorePanel: { backgroundColor: theme.paper, padding: 24, borderRadius: 6 },
});
