import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { keywordRepository } from '../catalogue/keywords';
import { theme } from '../theme/tokens';
import { Button } from './Button';
import { CardColours } from './cards/CardColours';
import { RichParagraph } from './cards/RichParagraph';
import { useKeywordHelp } from './KeywordHelpContext';

export function KeywordHelpOverlay({ modal = false }: { modal?: boolean }) {
  const help = useKeywordHelp(), definition = help?.keyword && keywordRepository.resolve(help.keyword);
  if (!help?.keyword || !definition) return null;
  const content = <SafeAreaView style={styles.overlay}>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss keyword definition" style={StyleSheet.absoluteFill} onPress={help.dismiss} />
    <View accessibilityViewIsModal style={styles.popup}>
      <View style={styles.header}>
        <View style={styles.identity}><Text accessibilityRole="header" style={styles.title}>{help.keyword}</Text>
          {definition.title !== help.keyword && <Text style={styles.details}>{definition.title}</Text>}
        </View>
        <Button quiet label="Close keyword definition" onPress={help.dismiss}><Text style={styles.close}>×</Text></Button>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} key={help.keyword}>
        <CardColours exhausted={false}>
          <View style={styles.definition}>
            {definition.auto && <Text style={styles.details}>Auto- makes this ability trigger during the first ability window instead of the listed timing.</Text>}
            <RichParagraph paragraph={definition.main} inlineGates size={15} align="left" />
            {definition.sections.map((section, index) => <View key={index} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.content ? <RichParagraph paragraph={section.content} inlineGates size={15} align="left" /> : <Text style={styles.details}>Definition not supplied.</Text>}
            </View>)}
          </View>
        </CardColours>
      </ScrollView>
    </View>
  </SafeAreaView>;
  return modal ? <Modal transparent visible animationType="fade" onRequestClose={help.dismiss}>{content}</Modal> : content;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#29272380', padding: 20, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  popup: { width: '100%', maxWidth: 460, maxHeight: '85%', borderRadius: 10, overflow: 'hidden', backgroundColor: theme.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderColor: theme.line },
  identity: { flex: 1, gap: 4 }, title: { fontFamily: theme.serif, fontSize: 23, color: theme.ink },
  close: { fontSize: 24, lineHeight: 26, color: theme.ink }, body: { padding: 20 }, definition: { gap: 12 }, section: { gap: 6 },
  sectionTitle: { fontSize: 17, fontFamily: theme.serif, color: theme.ink }, details: { fontSize: 13, lineHeight: 20, color: theme.muted },
});
