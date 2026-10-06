import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CardDefinition } from '../../domain/cards';
import { displayValue, objects, strings } from '../../domain/card-presentation';
import { technologyData, technologyName, technologyType } from '../../domain/technologies';
import type { RequirementStatus, TechnologySide } from '../../domain/technologies';
import { NavigationIcon } from '../../navigation/NavigationIcon';
import { gearTheme } from '../../theme/gear-tokens';
import { CardIcon } from './CardIcon';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';
import { coreTechnologyLayout } from './technology-layout';
import { TechnologyRequirements } from './TechnologyRequirements';

export const technologyColours = { background: '#001C21', heading: '#00434E', ability: '#000F11', recipe: '#001215' } as const;

/** The logical project/technology sides are independent of ATCC's optional renamed back face. */
export function TechnologyCard({ card, side = 'technology', width = 270, requirementStatus, onReference, onKeyword, renderRecipeLink }: TextActions & {
  card: CardDefinition; side?: TechnologySide; width?: number; requirementStatus?: RequirementStatus;
  renderRecipeLink?: (id: string, label: string) => ReactNode;
}) {
  const data = technologyData(card), project = side === 'project', type = technologyType(card);
  const core = type === 'Core', landscape = core && width >= 450, goldIcon = core && card.faces[0].cycle === 'Cycle IV';
  const name = technologyName(card, side), ink = project ? '#000000' : '#FFFFFF';
  const flavor = displayValue(project ? data.flavorProject : data.flavorTech);
  const reference = (id: unknown, label: string) => typeof id === 'string' && id && onReference
    ? <Pressable accessibilityRole="link" accessibilityLabel={`View ${label}`} onPress={() => onReference(id, label)}>
        <Text style={styles.reference}>{label}</Text>
      </Pressable> : <Text style={styles.recipeName}>{label}</Text>;
  return <View style={[styles.card, { width, minHeight: landscape ? width * coreTechnologyLayout.height / coreTechnologyLayout.width : width * (core ? 1.4 : 1.45), backgroundColor: project ? gearTheme.papyrus : technologyColours.background }]}>
    <View style={styles.header}>
      <View style={styles.typeIcon}><CardIcon name={data.techType === 'Combat' ? 'CombatTech' : 'StructuralTech'} size={26} invert={!goldIcon} colour={goldIcon ? '#D4B853' : '#FFFFFF'} tint={goldIcon ? '#D4B853' : undefined} /></View>
      <Text accessibilityRole="header" style={[styles.title, { color: ink, fontSize: Math.max(14, Math.min(19, width / (Math.max(1, name.length) * 0.6))) }]}>{name.toUpperCase()}</Text>
      <View style={{ width: core ? 38 : 20 }} />
    </View>
    <Text style={[styles.type, { color: ink }]}>{type} · {card.faces[0].cycle}{project ? ' · Project' : ''}</Text>
    {flavor !== '' && <Text style={[styles.flavor, { color: ink, borderColor: project || core ? gearTheme.papyrusDark : technologyColours.heading }]}>{flavor}</Text>}
    {project ? <View style={styles.project}>
      {(['requirements', 'leadsTo'] as const).map(field => <View key={field} style={[styles.projectGroup, core && styles.coreProjectGroup]}>
        <Text style={styles.projectHeading}>{field === 'requirements' ? 'REQUIREMENTS' : 'LEADS TO'}</Text>
        <View style={[styles.projectBox, core && styles.coreProjectBox]}>{field === 'requirements' && requirementStatus ? <TechnologyRequirements status={requirementStatus} /> : <>{strings(data[field]).filter(value => value.trim()).map((value, index) => {
          const threshold = /^@?(ArgoKnowledge|ArgoFate)\s+(\d+\+)$/i.exec(value.trim());
          return threshold ? <View key={index} accessibilityLabel={value.replace('@', '')} style={styles.threshold}>
            <CardIcon name={threshold[1].toLowerCase() === 'argoknowledge' ? 'ArgoKnowledge' : 'ArgoFate'} size={18} />
            <Text style={styles.requirement}>{threshold[2]}</Text>
          </View> : <Text key={index} style={styles.requirement}>{value}</Text>;
        })}{!strings(data[field]).some(value => value.trim()) && <Text style={styles.requirement}>—</Text>}</>}</View>
      </View>)}
    </View> : <View style={styles.benefits}>
      {displayValue(data.facilityName) !== '' && <Text style={styles.facility}>{displayValue(data.facilityName)}</Text>}
      {objects(data.abilities).map((ability, index) => <View key={index} style={styles.abilityGroup}>
        <Text style={styles.abilityHeading}>{displayValue(ability.name).toUpperCase() || 'ABILITY'}</Text>
        <View style={[styles.ability, core && styles.coreAbility]}>
          {ability.type != null && <View style={styles.threshold}>
            {ability.type === 'City Negotiation' && <CardIcon name="City" size={18} invert colour="#FFFFFF" />}
            <Text style={styles.abilityType}>{ability.type === 'City Negotiation' ? 'Negotiation.' : `${displayValue(ability.type)}.`}</Text>
          </View>}
          <RichParagraph paragraph={ability.effects} size={13} colour="#FFFFFF" invert onReference={onReference} onKeyword={onKeyword} />
        </View>
      </View>)}
      {objects(data.recipes).filter(recipe => recipe.name || objects(recipe.ingredients).length).map((recipe, index) => <View key={index} style={styles.recipe}>
        {typeof recipe.refID === 'string' && recipe.refID && renderRecipeLink
          ? renderRecipeLink(recipe.refID, displayValue(recipe.name)) : reference(recipe.refID, displayValue(recipe.name))}
        <View style={styles.ingredients}>{objects(recipe.ingredients).map((ingredient, index) => <View key={index} style={styles.ingredient}>
          <Text style={styles.ingredientText}>{displayValue(ingredient.count)}× </Text>
          {typeof ingredient.refID === 'string' && onReference ? reference(ingredient.refID, displayValue(ingredient.name))
            : <Text style={styles.ingredientText}>{displayValue(ingredient.name)}</Text>}
        </View>)}</View>
      </View>)}
      {(data.trireme === 'TRUE' || displayValue(data.charges) !== '') && <View style={styles.charges}>
        {data.trireme === 'TRUE' && <View accessibilityLabel="Trireme" style={styles.charge}><NavigationIcon name="Argo" colour="#D3D3D3" /></View>}
        {displayValue(data.charges) !== '' && <View accessibilityLabel={`${displayValue(data.charges)} charges`} style={styles.charge}><Text style={styles.chargeValue}>{displayValue(data.charges)}</Text></View>}
      </View>}
    </View>}
    <Text style={[styles.footer, { color: ink }]}>ID(s): {card.printedIds.join(', ') || 'Not supplied'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { maxWidth: '100%', padding: 10, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: technologyColours.heading },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 }, typeIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: technologyColours.heading, backgroundColor: technologyColours.background, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' }, type: { fontSize: 11, textAlign: 'center', opacity: 0.8 },
  flavor: { fontSize: 12, lineHeight: 17, textAlign: 'center', fontStyle: 'italic', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 5 },
  project: { gap: 18, flexGrow: 1, paddingTop: 6, paddingBottom: 18 }, projectGroup: { alignItems: 'center' },
  projectHeading: { backgroundColor: technologyColours.heading, color: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, fontWeight: '700' },
  projectBox: { width: '90%', padding: 10, gap: 7, backgroundColor: gearTheme.papyrusDark }, requirement: { textAlign: 'center', color: '#000000', fontSize: 13, lineHeight: 19 },
  coreProjectGroup: { width: '80%', alignSelf: 'center' }, coreProjectBox: { width: 'auto', minWidth: '50%', maxWidth: '100%' }, coreAbility: { width: '90%' },
  threshold: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 5 },
  benefits: { gap: 16, flexGrow: 1 }, abilityGroup: { alignItems: 'center' },
  abilityHeading: { color: '#FFFFFF', backgroundColor: technologyColours.heading, borderWidth: 1, borderColor: '#FFFFFF', paddingHorizontal: 5, paddingVertical: 3, fontSize: 12, textAlign: 'center', maxWidth: '100%' },
  ability: { width: '96%', padding: 10, gap: 5, backgroundColor: technologyColours.ability, borderWidth: 1, borderColor: technologyColours.heading },
  abilityType: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }, facility: { color: '#FFFFFF', backgroundColor: technologyColours.heading, fontSize: 15, padding: 6, textAlign: 'center' },
  recipe: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: technologyColours.heading, paddingTop: 6, gap: 5 },
  recipeName: { color: '#FFFFFF', fontStyle: 'italic', fontSize: 13, lineHeight: 19, paddingHorizontal: 8 }, reference: { color: '#89E2EC', textDecorationLine: 'underline', fontSize: 13, lineHeight: 19 },
  ingredients: { backgroundColor: technologyColours.recipe, padding: 8, gap: 4 }, ingredient: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }, ingredientText: { color: '#FFFFFF', fontSize: 13, lineHeight: 19 },
  charges: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 8 }, charge: { width: 62, height: 62, borderRadius: 31, backgroundColor: technologyColours.ability, borderWidth: 1, borderColor: technologyColours.heading, justifyContent: 'center', alignItems: 'center' },
  chargeValue: { color: '#D3D3D3', fontSize: 30 }, footer: { fontSize: 10, lineHeight: 15, opacity: 0.75, marginTop: 8 },
});
