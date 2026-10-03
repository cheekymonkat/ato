import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Chevron } from '../components/Icon';
import { theme } from '../theme/tokens';

export function DashboardMenu({ visible, compact, onClose, onBrowseGear, onProfiles, onRules, onClearAll }: {
  visible: boolean; compact: boolean; onClose: () => void; onBrowseGear: () => void; onProfiles: () => void; onRules: () => void; onClearAll: () => void;
}) {
  return <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.overlay, compact && styles.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss menu" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={styles.menu}>
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Menu</Text>
          <Button quiet label="Close menu" onPress={onClose} style={styles.closeButton}><Text style={styles.close}>×</Text></Button>
        </View>
        <Button quiet label="Browse Gear" onPress={onBrowseGear} style={styles.item}>
          <Text style={styles.itemLabel}>Browse Gear</Text><Chevron />
        </Button>
        <Button quiet label="Campaigns & backups" onPress={onProfiles} style={styles.item}>
          <Text style={styles.itemLabel}>Campaigns & backups</Text><Chevron />
        </Button>
        <Button quiet label="Rules assistance" onPress={onRules} style={styles.item}>
          <Text style={styles.itemLabel}>Rules assistance</Text><Chevron />
        </Button>
        <Button quiet label="Tides of Fate" onPress={onClearAll} style={[styles.item, styles.clearItem]}>
          <Text style={[styles.itemLabel, { color: theme.danger }]}>Tides of Fate</Text><Chevron />
        </Button>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 32, paddingTop: 12, backgroundColor: '#29272340' },
  compact: { paddingHorizontal: 16 }, menu: { width: '100%', maxWidth: 280, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 8, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8 }, title: { color: theme.ink, fontFamily: theme.serif, fontSize: 20 },
  closeButton: { borderWidth: 0, padding: 0, width: 44 }, close: { color: theme.ink, fontSize: 24 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0, backgroundColor: theme.panel, paddingHorizontal: 12 },
  itemLabel: { color: theme.ink, fontSize: 14 },
  clearItem: { marginTop: 8, borderTopWidth: 1, borderColor: theme.line },
});
