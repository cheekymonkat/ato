import { StyleSheet, Text, View } from 'react-native';
import { keywordRepository } from '../../catalogue/keywords';
import { formatParagraph } from '../../domain/card-presentation';
import { gearTheme } from '../../theme/gear-tokens';
import { CardIcon } from './CardIcon';
import { GateBadge } from './GateBadge';

export interface TextActions { onReference?: (id: string, name: string) => void; onKeyword?: (name: string) => void }
export function RichParagraph({ paragraph, prefix = '', size = 13, colour = '#000000', align = 'center', invert = false, inlineGates = false, onReference, onKeyword }: TextActions & {
  paragraph: unknown; prefix?: string; size?: number; colour?: string; align?: 'left' | 'center'; invert?: boolean; inlineGates?: boolean;
}) {
  const formatted = formatParagraph(paragraph, inlineGates);
  return <View accessibilityLabel={`${prefix}${formatted.label}`} style={styles.paragraph}>
    {formatted.blocks.map((block, blockIndex) => <View key={blockIndex} style={[styles.flow, { justifyContent: align === 'center' ? 'center' : 'flex-start' }]}>
      {block.map((word, wordIndex) => <View key={wordIndex} style={[styles.word, { marginRight: word.spaceAfter ? size * 0.28 : 0, minHeight: size * 1.5 }]}>
        {Boolean(prefix) && blockIndex === 0 && wordIndex === 0 && <Text style={{ color: colour, fontSize: size, lineHeight: size * 1.5 }}>{prefix}</Text>}
        {word.segments.map((segment, index) => segment.kind === 'icon' ? <CardIcon key={index} name={segment.name} size={size} invert={invert} colour={colour} /> : segment.kind === 'gate' ? <GateBadge key={index} gate={segment.gate} height={size * 1.15} /> : <Text key={index}
          accessibilityRole={segment.reference && onReference || segment.keyword && onKeyword && keywordRepository.resolve(segment.keyword) ? 'link' : undefined}
          onPress={segment.reference && onReference ? () => onReference(segment.reference!, segment.text) : segment.keyword && onKeyword && keywordRepository.resolve(segment.keyword) ? () => onKeyword(segment.keyword!) : undefined}
          style={{ color: segment.reference && onReference ? invert ? '#89E2EC' : gearTheme.reference : colour,
            fontSize: size, lineHeight: size * 1.5, fontWeight: segment.format === 'bold' ? '700' : '400', fontStyle: segment.format === 'italics' ? 'italic' : 'normal',
            textDecorationLine: segment.reference && onReference || segment.keyword && onKeyword && keywordRepository.resolve(segment.keyword) ? 'underline' : 'none',
            textDecorationStyle: segment.reference ? 'dashed' : 'dotted', flexShrink: 1 }}>{segment.text}</Text>)}
      </View>)}
    </View>)}
    {__DEV__ && formatted.diagnostics.length > 0 && <Text style={styles.diagnostic}>{[...new Set(formatted.diagnostics)].join(' · ')}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  paragraph: { flexShrink: 1 }, flow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }, word: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', flexShrink: 0 },
  diagnostic: { fontSize: 10, color: '#A3423D', marginTop: 4 },
});
