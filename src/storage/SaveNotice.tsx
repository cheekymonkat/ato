import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { getCatalogue } from '../catalogue';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { referenceProblems } from './workspace';
import { campaignCycle } from '../domain/campaign';

export function SaveNotice({ showStatus = true }: { showStatus?: boolean }) {
  const { party, profile, preview, exitPreview, saveStatus, saveError, flush } = useParty();
  const hasNotices = useMemo(() => profile.party.catalogueVersion !== getCatalogue().version || referenceProblems(profile.party, getCatalogue()).length > 0, [profile.party]);
  return <View style={styles.notice}>
    <Text accessibilityLiveRegion="polite" style={styles.status}>{showStatus ? `${profile.name} · ${preview ? 'Temporary preview · not saved' : saveStatus === 'saved' ? 'Saved locally' : saveStatus === 'saving' ? 'Saving…' : 'Save failed'}` : `Campaign: ${profile.name} - Cycle ${campaignCycle(party)}`}</Text>
    {preview && !showStatus && <Text style={styles.status}>Temporary preview · not saved</Text>}
    {preview && <Button quiet label="Leave preview" onPress={() => { exitPreview(); router.replace({ pathname: '/argonaut/[id]', params: { id: profile.party.activeArgonautId } }); }} />}
    {hasNotices && <Button quiet label="Review saved card notices" onPress={() => router.push('/profiles')} />}
    {saveError && !preview && <><Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>
      <View style={styles.actions}><Button quiet label="Retry save" onPress={() => void flush().catch(() => {})} />
        <Button quiet label="Back up party" onPress={() => router.push('/profiles')} /></View></>}
  </View>;
}
const styles = StyleSheet.create({
  notice: { gap: 6 }, status: { color: theme.muted, fontSize: 12 }, error: { color: theme.danger, fontSize: 14 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
