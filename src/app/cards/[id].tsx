import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../../catalogue';
import { CardInspection } from '../../cards/CardInspection';
import { Button } from '../../components/Button';
import { theme } from '../../theme/tokens';

export default function CardScreen() {
  const { id, face } = useLocalSearchParams<{ id: string; face?: string }>();
  const card = getCatalogue().get(id);
  return card ? <CardInspection key={id} card={card} faceId={face === 'back' ? 'back' : 'front'} /> : <View style={styles.missing}>
    <Text style={styles.title}>Card unavailable</Text><Text>This card definition could not be found.</Text>
    <Button label="Browse Gear" onPress={() => router.replace('/gear')} />
  </View>;
}
const styles = StyleSheet.create({ missing: { flex: 1, padding: 24, backgroundColor: theme.canvas, gap: 20, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 24, color: theme.ink } });
