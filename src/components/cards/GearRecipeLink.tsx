import { Pressable, StyleSheet, Text } from 'react-native';
import { getCatalogue } from '../../catalogue';
import { GearPreviewTrigger } from './GearPreviewTrigger';
import type { TextActions } from './RichParagraph';

/** Only resolved Gear recipes preview here; Titan and unresolved references retain navigation. */
export function GearRecipeLink({ id, label, onReference, onKeyword }: TextActions & { id: string; label: string }) {
  const resolution = getCatalogue().resolveReference(id);
  if (resolution.status === 'resolved' && resolution.card.family === 'Gear') {
    return <GearPreviewTrigger card={resolution.card} referenceId={id} label={label} onReference={onReference} onKeyword={onKeyword} />;
  }
  return <Pressable accessibilityRole="link" accessibilityLabel={`View ${label}`} onPress={() => onReference?.(id, label)}>
    <Text style={styles.link}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({ link: { color: '#89E2EC', textDecorationLine: 'underline', fontSize: 13, lineHeight: 19 } });
