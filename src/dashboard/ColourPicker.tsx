import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { isColour } from '../domain/party';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { SwipeGuard } from '../components/SwipeSurface';
import { colourChoices, theme } from '../theme/tokens';

export function ColourPicker({ colour, onSelect, onClose }: { colour: string; onSelect: (colour: string) => void; onClose: () => void }) {
  const [custom, setCustom] = useState(colour);
  return <Sheet visible title="Argonaut colour" subtitle="A colour to recognise your Argonaut at a glance." onClose={onClose}>
    <View style={styles.palette}>{colourChoices.map(choice => <View key={choice.value} style={styles.choice}>
      <Button quiet label={choice.name} selected={colour.toUpperCase() === choice.value} onPress={() => onSelect(choice.value)} style={styles.swatchButton}>
        <View style={[styles.swatch, { backgroundColor: choice.value }]}>
          {colour.toUpperCase() === choice.value && <Text style={styles.check}>✓</Text>}
        </View>
      </Button><Text style={styles.choiceName}>{choice.name}</Text>
    </View>)}</View>
    <Text style={styles.label}>CUSTOM COLOUR</Text>
    <SwipeGuard><TextInput accessibilityLabel="Custom Argonaut colour" autoCapitalize="characters" autoCorrect={false}
      maxLength={7} value={custom} onChangeText={setCustom} placeholder="#RRGGBB" style={styles.input} /></SwipeGuard>
    <Text style={styles.hint}>Enter a six-digit hex colour, such as #416EAA.</Text>
    <Button label="Use custom colour" disabled={!isColour(custom)} onPress={() => onSelect(custom)} />
  </Sheet>;
}
const styles = StyleSheet.create({
  palette: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }, choice: { width: '25%', alignItems: 'center', gap: 6 },
  swatchButton: { borderWidth: 0, padding: 5, width: 56, height: 56 }, swatch: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  check: { color: theme.white, fontSize: 22, fontWeight: '700' }, choiceName: { color: theme.muted, fontSize: 11 },
  label: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 16 },
  input: { color: theme.ink, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white, borderRadius: 5, padding: 12, minHeight: 48, fontSize: 16 },
  hint: { color: theme.muted, fontSize: 12, lineHeight: 18 },
});
