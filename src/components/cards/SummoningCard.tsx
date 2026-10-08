import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { displayGate, displayValue, objects, strings } from '../../domain/card-presentation';
import type { JsonObject } from '../../domain/json';
import { CardIcon } from './CardIcon';
import { useCardColours } from './CardColours';
import { CatalogueBadge, CatalogueFooter, CatalogueFrame, CatalogueTitle } from './CatalogueFrame';
import { DiceStack } from './GearCard';
import { GateBadge } from './GateBadge';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';

function SummoningPanel({ title, godform = false, children }: { title?: string; godform?: boolean; children: ReactNode }) {
  const paint = useCardColours();
  return <View style={styles.panel}>
    {Boolean(title) && <CatalogueBadge title={title!} background={godform ? '#245158' : '#000000'} />}
    <View style={[styles.panelBody, { backgroundColor: paint.colour('#CAC7B9'), borderColor: paint.colour('#B7B4A5') }]}>{children}</View>
  </View>;
}
export function NymphCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  const summoning = [{ abilityText: [
    { type: 'plainText', value: 'Spend 1 ' }, { type: 'icon', value: 'SummonCharge' },
    { type: 'plainText', value: ` to summon the ${face.name}. Then, ` }, { type: 'icon', value: 'Adversary' },
  ] }];
  return <CatalogueFrame face={face} width={width}>
    <View style={styles.body}>
      <CatalogueTitle name={face.name} subtitle={displayValue(face.data.title)} />
      <SummoningPanel title="Requirements"><RichParagraph paragraph={face.data.requirements} inlineGates size={14} {...actions} /></SummoningPanel>
      <SummoningPanel title="Summoning"><RichParagraph paragraph={summoning} size={14} {...actions} /></SummoningPanel>
      <SummoningPanel title="Effect"><RichParagraph paragraph={face.data.effects} inlineGates size={14} {...actions} /></SummoningPanel>
    </View>
    <CatalogueFooter face={face} />
  </CatalogueFrame>;
}

function GodformAttack({ attack }: { attack: JsonObject }) {
  return <View style={styles.attack}>
    {Boolean(attack.attackDice) && <View accessible accessibilityLabel={`Attack dice ${attack.attackDice}`} style={styles.attackStat}><Text style={styles.statText}>{displayValue(attack.attackDice)}</Text><CardIcon name="d10" size={22} /></View>}
    {Boolean(attack.precision) && <View accessible accessibilityLabel={`Precision ${attack.precision}`} style={styles.attackStat}><Text style={styles.statText}>{displayValue(attack.precision)}</Text></View>}
    {objects(attack.power).map((power, index) => {
      const gate = displayGate(power.gate);
      return <View key={index} style={styles.attackPower}>
        {gate && <GateBadge gate={gate} height={16} />}
        <View style={styles.attackStat}>{Boolean(power.plus) && <Text style={styles.statText}>+</Text>}<DiceStack dice={strings(power.type)} /></View>
      </View>;
    })}
  </View>;
}

export function GodformCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  const paint = useCardColours(), data = face.data, stats = displayValue(data.stats).split(/,\s*/).filter(Boolean);
  return <CatalogueFrame face={face} width={width}>
    <View style={styles.godformBody}>
      <CatalogueTitle name={face.name} background="#488791" colour="#FFFFFF" />
      {objects(data.abilities).map((ability, index) => <SummoningPanel key={index} title={displayValue(ability.name)} godform>
        <View style={styles.ability}>
          {objects([ability.attack]).map((attack, attackIndex) => <GodformAttack key={attackIndex} attack={attack} />)}
          <View style={styles.abilityText}><RichParagraph paragraph={ability.effects} inlineGates size={14} {...actions} /></View>
        </View>
      </SummoningPanel>)}
      {objects(data.keywords).length > 0 && <SummoningPanel godform><RichParagraph paragraph={data.keywords} inlineGates boldKeywords size={14} {...actions} /></SummoningPanel>}
    </View>
    <View>
      <View style={[styles.stats, { backgroundColor: paint.colour('#CAC7B9'), borderColor: paint.colour('#B7B4A5') }]}>
        <View accessible accessibilityLabel={`Power ${displayValue(data.power)}`} style={styles.pill}>{data.power === '*' ? <Text style={styles.statText}>*</Text> : <CardIcon name={displayValue(data.power)} type="Power" size={23} />}</View>
        <View accessible accessibilityLabel={`Speed ${displayValue(data.speed)}`} style={styles.pill}><CardIcon name="Speed" size={22} /><Text style={styles.statText}>{displayValue(data.speed)}</Text></View>
        {stats.map((stat, index) => {
          const [amount, ...name] = stat.split(' ');
          return <View key={index} accessible accessibilityLabel={stat} style={styles.stat}><Text style={styles.statText}>{amount}</Text><CardIcon name={name.join('')} size={23} /></View>;
        })}
      </View>
      <CatalogueFooter face={face} />
    </View>
  </CatalogueFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 10, paddingBottom: 20, gap: 16 }, godformBody: { paddingBottom: 20, gap: 16 },
  panel: { marginHorizontal: '5%' }, panelBody: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  ability: { flexDirection: 'row', gap: 10, alignItems: 'center' }, abilityText: { flex: 4, minWidth: 0 },
  attack: { width: 58, gap: 8 }, attackStat: { backgroundColor: '#BFBCAB', minHeight: 30, paddingVertical: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }, attackPower: { alignItems: 'center' },
  stats: { marginHorizontal: '5%', padding: 8, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pill: { backgroundColor: '#FFFFFF', borderColor: '#245158', borderWidth: 1, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 }, statText: { color: '#000000', fontSize: 17, lineHeight: 24 },
});
