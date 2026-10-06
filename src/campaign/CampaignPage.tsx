import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SaveNotice } from '../storage/SaveNotice';
import { theme } from '../theme/tokens';
export function CampaignPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.canvas }}>
    <ScrollView style={campaignStyles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={campaignStyles.page}>
      <View style={{ gap: 8 }}><Text style={campaignStyles.eyebrow}>YOUR EXPEDITION</Text><SaveNotice showStatus={false} /></View>
      <Text accessibilityRole="header" style={campaignStyles.title}>{title}</Text>
      {subtitle && <Text style={campaignStyles.body}>{subtitle}</Text>}{children}
    </ScrollView>
  </SafeAreaView>;
}
export const campaignStyles = StyleSheet.create({
  scroll: { flex: 1, minHeight: 0 },
  page: { flexShrink: 0, padding: 24, gap: 20, width: '100%', maxWidth: 1440, marginHorizontal: 'auto', paddingBottom: 48 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: theme.muted },
  title: { fontFamily: theme.serif, fontSize: 32, color: theme.ink }, heading: { fontFamily: theme.serif, fontSize: 22, color: theme.ink },
  body: { fontSize: 14, lineHeight: 22, color: theme.ink }, meta: { fontSize: 12, lineHeight: 19, color: theme.muted },
  warning: { fontSize: 14, lineHeight: 22, color: theme.danger },
  panel: { backgroundColor: theme.paper, padding: 16, borderWidth: 1, borderColor: theme.line, borderRadius: 6, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 5, padding: 12, color: theme.ink, fontSize: 16 },
});
