import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { keywordRepository } from '../../catalogue/keywords';
import type { CardFace } from '../../domain/cards';
import { displayValue, strings } from '../../domain/card-presentation';
import { isRecord } from '../../domain/json';
import { titanAbilityRows, titanDiceModifiers, titanSymbolAbility } from '../../domain/titan-presentation';
import { titanVariantDisplayName as titanDisplayName } from '../../domain/titan-selection';
import { gearTheme as g } from '../../theme/gear-tokens';
import { patternIcons } from '../../theme/pattern-icons';
import { theme } from '../../theme/tokens';
import { Button } from '../Button';
import { Chevron } from '../Icon';
import { useKeywordHelp } from '../KeywordHelpContext';
import { AbilityCostIcon, AbilityPanel } from './AbilityState';
import { useCardColours } from './CardColours';
import { CardIcon } from './CardIcon';
import { DiceStack } from './GearCard';
import { RichParagraph } from './RichParagraph';
import { adjustedStat, MODIFIED_STAT_COLOUR } from '../../domain/combat-modifiers';
import { useCombatAdjustment } from './CombatStats';

/** The title opens Titan selection; keywords and individual ability controls remain independent. */
export function TitanCardBody({ face, ink, headerActions, onSelect, rage = 0 }: {
  face: Extract<CardFace, { kind: 'titan' }>; ink: string; headerActions?: ReactNode; onSelect?: () => void; rage?: number;
}) {
  const paint = useCardColours(), help = useKeywordHelp();
  const speed = adjustedStat(face.data.speed, useCombatAdjustment(face, 'speed'));
  const rows = titanAbilityRows(face, keywordRepository);
  const limits = rows.flatMap(row => { const symbol = titanSymbolAbility(row.heading); return symbol?.kind === 'limit' ? [symbol] : []; });
  return <>
    <Text style={[styles.meta, { color: ink }]}>{face.family} · {face.cycle}</Text>
    {onSelect ? <Button quiet label={`Choose Titan: ${titanDisplayName(face)}`} onPress={onSelect} style={styles.selector}>
      <Text accessibilityRole="header" style={[styles.name, { color: ink }]}>{titanDisplayName(face)}</Text><Chevron direction="down" />
    </Button> : <Text accessibilityRole="header" style={[styles.name, { color: ink }]}>{titanDisplayName(face)}</Text>}
    <View style={styles.stats}>
      <View accessible accessibilityLabel={`Movement ${speed.label}`} style={styles.speed}>
        <CardIcon name="Speed" size={24} /><Text style={[styles.statText, { color: paint.colour(speed.changed ? MODIFIED_STAT_COLOUR : '#000000') }]}>{speed.text}</Text>
      </View>
      <DiceStack dice={[face.data.titanPower]} />
      {titanDiceModifiers(face, rage).map(symbol => symbol && <Button key={symbol.name} quiet label={symbol.name} disabled={!help}
        onPress={() => help?.open(symbol.name)} style={styles.diceModifier}>
        <Text style={styles.modifierText}>+</Text>
        <SvgXml aria-hidden xml={paint.svg(patternIcons[symbol.symbol as keyof typeof patternIcons])} width={23} height={23} />
        <Text style={styles.modifierText}>{symbol.value}</Text>
      </Button>)}
    </View>
    {limits.length > 0 && <View style={styles.limits}>{limits.map(limit => <Button key={limit.name} quiet label={limit.name}
      disabled={!help} onPress={() => help?.open(limit.name)} style={[styles.limit,
        { backgroundColor: paint.colour(limit.symbol === 'Ambrosia' ? '#D6AD3A' : limit.symbol === 'Bleeding' ? '#991E28' : theme.charcoal) }]}>
      <CardIcon name={limit.symbol} size={21} invert={limit.symbol !== 'Ambrosia'} />
      <Text style={[styles.limitText, { color: limit.symbol === 'Ambrosia' ? '#171715' : '#FFFFFF' }]}>{limit.value < 0 ? `−${Math.abs(limit.value)}` : limit.name.includes('Limit +') ? `+${limit.value}` : limit.value}</Text>
    </Button>)}</View>}
    {headerActions}
    {strings(face.data.traits).length > 0 && <Text style={styles.bodyText}>{strings(face.data.traits).join(' · ')}</Text>}
    {Boolean(face.data.flavor) && <Text style={styles.flavor}>{displayValue(face.data.flavor)}</Text>}
    <View style={styles.abilities}>{rows.filter(row => !titanSymbolAbility(row.heading)).map((row, index) => <View key={row.id}
      style={[styles.ability, index > 0 && { borderTopWidth: 1, borderTopColor: paint.colour(g.papyrusDark), paddingTop: 10 }]}>
      <AbilityPanel id={row.id} heading={row.heading} label={`${titanDisplayName(face)} ${row.details.map(detail => detail.name).join(', ') || `ability ${index + 1}`}`}>
        <View style={styles.abilityHeading}>
          <RichParagraph paragraph={isRecord(row.heading) ? { ...row.heading, costs: undefined } : row.heading} inlineGates boldKeywords size={14} align="left" />
          {isRecord(row.heading) && Array.isArray(row.heading.costs) && <View style={styles.costs}>{strings(row.heading.costs).map((cost, i) =>
            cost === 'Exhaust' ? <AbilityCostIcon key={`${cost}:${i}`} name={cost} size={18} /> :
              <View key={`${cost}:${i}`} accessible accessibilityLabel={`Cost: ${cost}`}><CardIcon name={cost} size={18} /></View>)}</View>}
        </View>
        {row.details.map(detail => <View key={detail.name} style={styles.explanation}>
          {row.details.length > 1 && <Text style={styles.detailName}>{detail.name}</Text>}
          {detail.definition ? <>
            {detail.definition.auto && <Text style={styles.bodyText}>Auto- triggers this ability during the first ability window instead of the listed timing.</Text>}
            <RichParagraph paragraph={detail.definition.main} inlineGates size={13} align="left" />
            {detail.definition.sections.map((section, sectionIndex) => <View key={sectionIndex} style={styles.explanation}>
              <Text style={styles.detailName}>{section.title}</Text>
              {section.content ? <RichParagraph paragraph={section.content} inlineGates size={13} align="left" /> : <Text style={styles.bodyText}>Definition not supplied.</Text>}
            </View>)}
          </> : <Text style={styles.bodyText}>Definition not supplied.</Text>}
        </View>)}
      </AbilityPanel>
    </View>)}</View>
  </>;
}
const styles = StyleSheet.create({
  selector: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: 2, flexDirection: 'row', justifyContent: 'flex-start', gap: 8 },
  name: { fontSize: 24, lineHeight: 30, textAlign: 'left', flexShrink: 1 },
  meta: { fontSize: 11, lineHeight: 17, textAlign: 'right' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  speed: { flexDirection: 'row', alignItems: 'center', gap: 6 }, statText: { fontSize: 19, lineHeight: 27 },
  diceModifier: { flexDirection: 'row', gap: 4, backgroundColor: theme.charcoal, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 0 },
  modifierText: { color: '#F1EBDE', fontSize: 16 },
  limits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, limit: { flexDirection: 'row', gap: 7, borderColor: theme.ink, paddingHorizontal: 10, paddingVertical: 6 },
  limitText: { fontSize: 17 }, bodyText: { fontSize: 12, lineHeight: 18, color: '#000000' },
  flavor: { fontSize: 12, lineHeight: 18, color: '#000000', fontStyle: 'italic' },
  abilities: { minWidth: 0, gap: 10 }, ability: { gap: 5 },
  abilityHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, costs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  explanation: { gap: 4, marginTop: 5 }, detailName: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#000000' },
});
