import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/tokens';
import { Button } from './Button';
import { KeywordHelpProvider, useKeywordHelp } from './KeywordHelpContext';
import { KeywordHelpOverlay } from './KeywordHelpOverlay';

type SheetProps = {
  title: string; subtitle?: string; visible: boolean; onClose: () => void; children: ReactNode; wide?: boolean; scrollKey?: string;
};
export function Sheet(props: SheetProps) {
  return <KeywordHelpProvider><SheetBody {...props} /></KeywordHelpProvider>;
}
function SheetBody({ title, subtitle, visible, onClose, children, wide = false, scrollKey }: SheetProps) {
  const help = useKeywordHelp(), showingKeyword = Boolean(help?.keyword);
  return <Modal transparent visible={visible} onRequestClose={showingKeyword ? help!.dismiss : onClose} animationType="fade">
    <SafeAreaView style={styles.overlay}>
      <View style={styles.contents} pointerEvents={showingKeyword ? 'none' : 'auto'} accessibilityElementsHidden={showingKeyword} importantForAccessibility={showingKeyword ? 'no-hide-descendants' : 'auto'} aria-hidden={showingKeyword}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss dialog" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[styles.sheet, wide && styles.wide]}>
        <View style={styles.header}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>
          <Button quiet label="Close dialog" onPress={onClose}><Text style={styles.close}>×</Text></Button>
        </View>
        <ScrollView key={scrollKey} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView>
      </View>
      </View>
      <KeywordHelpOverlay />
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#29272380', alignItems: 'center', justifyContent: 'center', padding: 20 },
  contents: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: theme.paper, borderRadius: 10, width: '100%', maxWidth: 460, maxHeight: '90%', overflow: 'hidden' },
  wide: { maxWidth: 620 }, header: { padding: 24, borderBottomWidth: 1, borderBottomColor: theme.line, flexDirection: 'row', gap: 16, alignItems: 'center' },
  title: { color: theme.ink, fontFamily: theme.serif, fontSize: 24 }, subtitle: { color: theme.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  body: { padding: 24, gap: 16 }, close: { color: theme.ink, fontSize: 24, lineHeight: 26 },
});
