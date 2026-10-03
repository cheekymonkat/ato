import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { diceLayers, displayGate, displayValue, gearTitleSize, objects, overheadGate, strings } from '../../domain/card-presentation';
import { cycleColour, gearTheme as g } from '../../theme/gear-tokens';
import { CardIcon } from './CardIcon';
import { CardColours, useCardColours } from './CardColours';
import { GateBackground, GateBadge, StatGate } from './GateBadge';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';
import { adjustedStat, MODIFIED_STAT_COLOUR } from '../../domain/combat-modifiers';
import { useCombatAdjustment } from './CombatStats';

export function DiceStack({ dice, type = 'Power', scale = 1 }: { dice: string[]; type?: 'Power' | 'Armor'; scale?: number }) {
  if (dice.length === 0) return null;
  const stack = dice.length > 1 && dice[0] !== 'Power';
  return <View accessible accessibilityLabel={`${dice.join(', ')} ${type} ${dice.length === 1 ? 'die' : 'dice'}`}
    style={{ minHeight: (20 + 5 * Math.floor((dice.length + 1) / 2)) * scale, width: stack ? 38 * scale : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
    {stack ? diceLayers(dice).map((layer, index) => <View key={index} style={{ position: 'absolute', zIndex: layer.zIndex, transform: [{ translateX: layer.x * scale }, { translateY: layer.y * scale }] }}>
      <CardIcon name={layer.name} type={type} size={15 * layer.em * scale} />
    </View>) : dice.map((name, index) => <CardIcon key={index} name={name} type={type} size={22.5 * scale} />)}
  </View>;
}

function Medallion({ name, colour, scale }: { name: string; colour: string; scale: number }) {
  const paint = useCardColours();
  return <View style={{ margin: 5 * scale, width: 42 * scale, height: 42 * scale, padding: 3 * scale, borderWidth: 3 * scale, borderColor: paint.colour(g.papyrus), borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: paint.colour(colour), boxShadow: `0 0 ${4 * scale}px ${3 * scale}px ${paint.colour(g.papyrusDark)}` }}>
    <View style={{ paddingTop: name === '1 Hand' ? 7.5 * scale : name === 'Armor' ? 1.5 * scale : 0 }}><CardIcon name={name} size={(name === 'Gear' ? 24 : 25.2) * scale} invert /></View>
  </View>;
}

/** Source-sized previews; inspection and equipped cards grow to show every ability and footer. */
type GearCardProps = TextActions & { face: Extract<CardFace, { kind: 'gear' }>; width?: number; preview?: boolean; exhausted?: boolean };
export function GearCard({ exhausted = false, ...props }: GearCardProps) {
  return <CardColours exhausted={exhausted}><GearCardFace {...props} /></CardColours>;
}
function GearCardFace({ face, width = g.width, preview = false, onKeyword, onReference }: GearCardProps) {
  const paint = useCardColours();
  const precision = adjustedStat(face.data.offensiveStatistics.precision ?? '', useCombatAdjustment(face, 'precision'));
  const scale = width / g.width, data = face.data, colour = paint.colour(cycleColour(face.cycle));
  const abilitySize = preview ? 13 * scale : Math.max(14, 13 * scale);
  const statSize = 15 * scale, pad = width * (25 / 130) * 0.03;
  const statCell = { minHeight: 25 * scale + pad * 2, paddingVertical: pad, backgroundColor: paint.colour(g.stat), alignItems: 'center' as const, justifyContent: 'center' as const };
  const offensive = data.offensiveStatistics, power = objects(offensive.power), defensive = objects(data.defensiveStatistics), groups = objects(data.gatedAbilities);
  const content = <View style={{ minHeight: g.height * scale, justifyContent: 'space-between', flexGrow: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * scale }}>
      <View style={{ flexGrow: 2, flexBasis: 30 * scale }}><Medallion name={data.slot} colour={colour} scale={scale} /></View>
      <Text accessibilityRole="header" style={{ flexGrow: 8, flexBasis: 0, color: colour === '#FFFFFF' ? '#000000' : colour, textAlign: 'center', fontSize: preview ? gearTitleSize(face.name) * scale : Math.max(16, gearTitleSize(face.name) * scale), lineHeight: (preview ? gearTitleSize(face.name) * scale : Math.max(16, gearTitleSize(face.name) * scale)) * 1.5 }}>{face.name}</Text>
      <View style={{ flexGrow: 2, flexBasis: 30 * scale, alignItems: 'flex-end' }}><Medallion name="Gear" colour={colour} scale={scale} /></View>
    </View>
    <View style={{ flexDirection: 'row', marginVertical: 10 * scale, alignItems: 'center' }}>
      <View style={{ flex: 25, gap: 8 * scale, overflow: 'hidden' }}>
        {Boolean(offensive.attackDice) && <View accessibilityLabel={`Attack dice ${offensive.attackDice}`} style={[statCell, styles.statRow]}><Text style={{ fontSize: statSize }}>{offensive.attackDice}</Text><CardIcon name="d10" size={statSize * 1.5} /></View>}
        {Boolean(offensive.precision) && <View style={statCell}><Text accessibilityLabel={`Precision ${precision.label}`} style={{ color: paint.colour(precision.changed ? MODIFIED_STAT_COLOUR : '#000000'), fontSize: statSize, lineHeight: statSize * 1.5 }}>{precision.text}</Text></View>}
        {power.map((entry, index) => {
          const gate = displayGate(entry.gate);
          return <View key={index} style={[statCell, gate && { paddingTop: 0 }, { alignItems: 'stretch' }]}>
            {gate && <StatGate gate={gate} scale={scale} />}
            <View style={[statCell, styles.statRow]}>{Boolean(entry.plus) && <Text style={{ fontSize: statSize }}>+ </Text>}<DiceStack dice={strings(entry.type)} scale={scale} /></View>
          </View>;
        })}
      </View>
      <View style={{ flex: 80 }} />
      <View style={{ flex: 25, gap: 8 * scale, overflow: 'hidden' }}>{defensive.map((entry, index) => {
        const type = displayValue(entry.type), resistance = ['Midas', 'Laser', 'Microwave', 'Sun', 'Despair', 'Pain'].includes(type), gate = displayGate(entry.gate);
        return <View key={index} style={{ backgroundColor: resistance ? '#000000' : paint.colour(g.stat), paddingBottom: pad }}>
          {gate && <StatGate gate={gate} scale={scale} />}
          <View style={[styles.statRow, { minHeight: 25 * scale }]}>{type === 'Armor' ? <DiceStack dice={strings(entry.armorDice)} type="Armor" scale={scale} /> : <>
            <Text style={{ color: resistance ? '#FFFFFF' : '#000000', fontSize: statSize }}>{displayValue(entry.amount)} </Text><CardIcon name={type} type="Armor" size={statSize * 1.5} invert={resistance} colour={resistance ? '#FFFFFF' : '#000000'} />
          </>}</View>
        </View>;
      })}</View>
    </View>
    <View>
      <View style={{ paddingHorizontal: 15 * scale, paddingBottom: 15 * scale }}>
        <RichParagraph paragraph={data.abilities} size={abilitySize} onKeyword={onKeyword} onReference={onReference} />
        {data.asteriskEffect != null && <View style={{ marginTop: 4 * scale }}><RichParagraph prefix="*" paragraph={[data.asteriskEffect]} size={preview ? 10 * scale : 12} onKeyword={onKeyword} onReference={onReference} /></View>}
      </View>
      {groups.map((group, index) => {
        const gate = displayGate(group), overhead = overheadGate(group, groups.length);
        return gate ? <View key={index} style={{ flexDirection: overhead ? 'column' : 'row', alignItems: 'center' }}>
          <GateBackground gate={gate} />
          <View style={{ paddingLeft: overhead ? 0 : 18 * scale, paddingVertical: 4 * scale }}><GateBadge gate={gate} height={15 * scale} /></View>
          <View style={{ flexShrink: 1, paddingHorizontal: 10 * scale }}><RichParagraph paragraph={group.abilities} size={abilitySize} colour="#FFFFFF" invert align={overhead ? 'center' : 'left'} onKeyword={onKeyword} onReference={onReference} /></View>
        </View> : <RichParagraph key={index} paragraph={group} size={abilitySize} />;
      })}
      <View style={{ backgroundColor: colour, paddingHorizontal: 10 * scale, paddingTop: 6 * scale, paddingBottom: 4 * scale }}>
        <Text style={{ color: colour === '#FFFFFF' ? '#000000' : '#FFFFFF', fontSize: preview ? 10 * scale : Math.max(11, 10 * scale), lineHeight: (preview ? 10 * scale : Math.max(11, 10 * scale)) * 1.5 }}>ID(s): {face.printedIds.join(', ') || 'Not supplied'}</Text>
      </View>
    </View>
  </View>;
  return <View testID={`gear-card-${face.id}`} style={{ width, maxWidth: '100%', backgroundColor: paint.colour(g.papyrus), borderRadius: 10 * scale, overflow: 'hidden' }}>
    {preview ? <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ height: g.height * scale }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
  </View>;
}
const styles = StyleSheet.create({ statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } });
