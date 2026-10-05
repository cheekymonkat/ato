import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { keywordRepository } from '../../catalogue/keywords';
import { formatParagraph } from '../../domain/card-presentation';
import { gearTheme } from '../../theme/gear-tokens';
import { CardIcon } from './CardIcon';
import { GateBadge } from './GateBadge';
import { useCardColours } from './CardColours';
import { useKeywordHelp } from '../KeywordHelpContext';
import { SwipeGuard } from '../SwipeSurface';
import { AbilityCostIcon } from './AbilityState';

export interface TextActions { onReference?: (id: string, name: string) => void; onKeyword?: (name: string) => void }
export function RichParagraph({ paragraph, prefix = '', size = 13, colour = '#000000', align = 'center', invert = false, inlineGates = false, boldKeywords = false, abilityCosts = false, onReference, onKeyword }: TextActions & {
  paragraph: unknown; prefix?: string; size?: number; colour?: string; align?: 'left' | 'center'; invert?: boolean; inlineGates?: boolean; boldKeywords?: boolean; abilityCosts?: boolean;
}) {
  const paint = useCardColours();
  const help = useKeywordHelp();
  const formatted = formatParagraph(paragraph, inlineGates);
  return <View accessibilityLabel={`${prefix}${formatted.label}`} style={styles.paragraph}>
    {formatted.blocks.map((block, blockIndex) => <View key={blockIndex} style={[styles.flow, { justifyContent: align === 'center' ? 'center' : 'flex-start' }]}>
      {block.map((word, wordIndex) => <View key={wordIndex} style={[styles.word, { marginRight: word.spaceAfter ? size * 0.28 : 0, minHeight: size * 1.5 }]}>
        {Boolean(prefix) && blockIndex === 0 && wordIndex === 0 && <Text style={{ color: paint.colour(colour), fontSize: size, lineHeight: size * 1.5 }}>{prefix}</Text>}
        {word.segments.map((segment, index) => {
          if (segment.kind === 'icon') {
            const Icon = abilityCosts ? AbilityCostIcon : CardIcon;
            return <Icon key={index} name={segment.name} size={size} invert={invert} colour={colour} />;
          }
          if (segment.kind === 'gate') return <GateBadge key={index} gate={segment.gate} height={size * 1.15} filled={inlineGates} />;
          const keywordAction = segment.keyword && keywordRepository.resolve(segment.keyword) ? help?.open || onKeyword : undefined;
          const referenceAction = segment.reference && onReference;
          const textStyle: TextStyle = { color: paint.colour(referenceAction ? invert ? '#89E2EC' : gearTheme.reference : colour),
            fontSize: size, lineHeight: size * 1.5, fontWeight: segment.format === 'bold' || boldKeywords && segment.keyword ? '700' : '400', fontStyle: segment.format === 'italics' ? 'italic' : 'normal',
            textDecorationLine: referenceAction || keywordAction ? 'underline' : 'none',
            textDecorationStyle: segment.reference ? 'dashed' : 'dotted', flexShrink: 1 };
          return keywordAction ? <SwipeGuard key={index}><Pressable accessibilityRole="link" accessibilityLabel={`Definition of ${segment.keyword}`}
            accessibilityHint="Opens the keyword definition without selecting the card" hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }} style={styles.keyword}
            onPress={event => { event.stopPropagation(); keywordAction(segment.keyword!); }}>
            <Text style={textStyle}>{segment.text}</Text>
          </Pressable></SwipeGuard> : <Text key={index} accessibilityRole={referenceAction ? 'link' : undefined}
            onPress={referenceAction ? event => { event.stopPropagation(); onReference!(segment.reference!, segment.text); } : undefined} style={textStyle}>{segment.text}</Text>;
        })}
      </View>)}
    </View>)}
    {__DEV__ && formatted.diagnostics.length > 0 && <Text style={[styles.diagnostic, { color: paint.colour('#A3423D') }]}>{[...new Set(formatted.diagnostics)].join(' · ')}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  paragraph: { flexShrink: 1 }, flow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }, word: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', flexShrink: 0 },
  diagnostic: { fontSize: 10, color: '#A3423D', marginTop: 4 },
  keyword: { minHeight: 24, justifyContent: 'center', flexShrink: 1 },
});
