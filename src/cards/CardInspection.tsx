import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { keywordRepository } from '../catalogue/keywords';
import { Button } from '../components/Button';
import { GearCard } from '../components/cards/GearCard';
import { GearRecipeLink } from '../components/cards/GearRecipeLink';
import { RichParagraph } from '../components/cards/RichParagraph';
import { SecretCard } from '../components/cards/SecretCard';
import { TechnologyCard } from '../components/cards/TechnologyCard';
import { CatalogueCard, supportsCatalogueCard } from '../components/cards/CatalogueCard';
import { catalogueCardSize } from '../components/cards/catalogue-layout';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { coreTechnologyWidth } from '../components/cards/technology-layout';
import { PatternTable } from '../components/PatternTable';
import { Sheet } from '../components/Sheet';
import { useKeywordHelp } from '../components/KeywordHelpContext';
import { cardLinks, displayValue, faceForReference, isSecretCard, objects, strings } from '../domain/card-presentation';
import type { CardDefinition, FaceId } from '../domain/cards';
import { technologyName, technologyResearchStatus, technologyType } from '../domain/technologies';
import type { TechnologySide } from '../domain/technologies';
import { useSpoilers } from '../state/SpoilerProvider';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';

export function CardInspection({ card, faceId, embedded = false, onNavigate, onFaceChange }: {
  card: CardDefinition; faceId: FaceId; embedded?: boolean;
  onNavigate?: (card: CardDefinition, faceId: FaceId) => void; onFaceChange?: (faceId: FaceId) => void;
}) {
  const face = card.faces.find(entry => entry.id === faceId) || card.faces[0];
  const { width } = useWindowDimensions(), spoilers = useSpoilers(), hidden = spoilers.hidden(card);
  const [keyword, setKeyword] = useState<string | null>(null), [reference, setReference] = useState<string | null>(null);
  const [technologySide, setTechnologySide] = useState<TechnologySide>('technology');
  const technology = technologyType(card) !== null;
  const { party } = useParty();
  const help = useKeywordHelp(), showKeyword = help?.open ?? setKeyword;
  const requirementStatus = technology ? technologyResearchStatus(card, party, getCatalogue()).requirements : undefined;
  const definition = keyword && keywordRepository.resolve(keyword), links = cardLinks(face);
  const availableWidth = embedded ? Math.max(1, Math.min(572, width - 88)) : width - 32;
  const inspectionWidth = technologyType(card) === 'Core' ? coreTechnologyWidth(availableWidth, width)
    : supportsCatalogueCard(face) ? catalogueCardSize(face, availableWidth).width : Math.min(450, availableWidth);
  function navigate(nextCard: CardDefinition, nextFace: FaceId) {
    setReference(null); setKeyword(null);
    if (onNavigate) onNavigate(nextCard, nextFace);
    else router.push({ pathname: '/cards/[id]', params: { id: nextCard.id, face: nextFace } });
  }
  function openReference(id: string) {
    const result = getCatalogue().resolveReference(id);
    if (result.status === 'resolved') {
      navigate(result.card, faceForReference(result.card, id).id);
    } else setReference(id);
  }
  const resolution = reference ? getCatalogue().resolveReference(reference) : null;
  const textActions = { onKeyword: showKeyword, onReference: openReference };
  const body = <>
      {!embedded && <View style={styles.header}><Button quiet label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/gear')} />
        <Text style={styles.eyebrow}>CARD INSPECTION</Text></View>}
      <View style={styles.toolbar}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.title}>{hidden ? 'Unrevealed card' : technology ? technologyName(card, technologySide) : face.name}</Text>
        <Text style={styles.subtitle}>{face.family} · {face.cycle}{technology && !hidden ? ` · ${technologySide === 'project' ? 'Project' : technologyName(card, 'technology')}` : card.faces.length > 1 && !hidden ? ` · ${face.id === 'front' ? 'Front' : 'Back'}` : ''}</Text></View>
        {!hidden && technology && <Button quiet label={technologySide === 'project' ? 'View technology' : 'View project'} onPress={() => setTechnologySide(technologySide === 'project' ? 'technology' : 'project')} />}
        {!hidden && !technology && card.faces.length > 1 && <Button quiet label={`Flip to ${face.id === 'front' ? 'back' : 'front'}`} onPress={() => {
          const nextFace = face.id === 'front' ? 'back' : 'front';
          if (onFaceChange) onFaceChange(nextFace); else router.setParams({ face: nextFace });
        }} />}
        {!hidden && isSecretCard(card) && spoilers.hideSecrets && <Button quiet label="Hide this card" onPress={() => spoilers.conceal(card.id)} />}
      </View>
      <View style={styles.presentation}>
        <View style={{ width: inspectionWidth, maxWidth: '100%' }}>{hidden ? <SecretCard card={card} onReveal={() => spoilers.reveal(card.id)} /> : technology ? <TechnologyCard card={card} side={technologySide} width={inspectionWidth} requirementStatus={requirementStatus} {...textActions}
          renderRecipeLink={(id, label) => <GearRecipeLink id={id} label={label} {...textActions} />} /> : face.kind === 'gear' ? <GearCard face={face} width={inspectionWidth} {...textActions} />
          : supportsCatalogueCard(face) ? <CatalogueCard card={card} face={face} width={inspectionWidth} {...textActions} />
          : face.kind === 'titan' || face.kind === 'mnemos' || face.kind === 'fated-mnemos' || face.family === 'Pattern' ? <ReferenceCard card={card} face={face} /> : <View style={styles.referenceCard}>
          <Text accessibilityRole="header" style={styles.referenceTitle}>{face.name}</Text>
          {strings(face.data.traits).length > 0 && <Text style={styles.details}>{strings(face.data.traits).join(' · ')}</Text>}
          {strings(face.data.keywords).length > 0 && <Text style={styles.details}>{strings(face.data.keywords).join(' · ')}</Text>}
          {objects(face.data.tiles).map((tile, index) => <Text key={index} style={styles.details}>{displayValue(tile.count)} × {displayValue(tile.type)} tile</Text>)}
          {['Story', 'Doom'].includes(face.family) && <>
            <Text style={styles.subtitle}>Card {displayValue(face.data.cardNumber ?? card.faces[0].data.cardNumber)}{face.id === 'front' ? 'A' : 'B'}</Text>
            {strings(face.data.flavor).map((text, index) => <Text key={index} style={styles.details}>{text}</Text>)}
            {face.data.rulesTitle != null && <Text style={styles.groupTitle}>{displayValue(face.data.rulesTitle)}</Text>}
            {(Array.isArray(face.data.rules) ? face.data.rules : []).map((rules, index) => <RichParagraph key={index} paragraph={rules} size={16} align="left" {...textActions} />)}
          </>}
          {['Exploration', 'Nymph'].includes(face.family) && face.data.requirements != null && <RichParagraph paragraph={face.data.requirements} prefix="Requirements: " size={16} align="left" {...textActions} />}
          {face.data.effects != null && <RichParagraph paragraph={face.data.effects} size={16} align="left" {...textActions} />}
          {['Exploration', 'Nymph'].includes(face.family) && ['effects2', 'removeEffect', 'acclimation'].map(field => face.data[field] != null && <RichParagraph key={field} paragraph={face.data[field]} size={16} align="left" {...textActions} />)}
          <RichParagraph paragraph={face.data.abilities} size={16} align="left" {...textActions} />
          {face.data.effect != null && <RichParagraph paragraph={face.data.effect} size={16} align="left" {...textActions} />}
          {Array.isArray(face.data.traumaTable) && face.data.traumaTable.length > 0 && <PatternTable kind="Trauma" table={face.data.traumaTable} />}
          {Array.isArray(face.data.kratosTable) && face.data.kratosTable.length > 0 && <PatternTable kind="Kratos" table={face.data.kratosTable} />}
          <Text style={styles.subtitle}>ID(s): {face.printedIds.join(', ') || 'Not supplied'}</Text>
        </View>}</View>
      </View>
      {!hidden && <View style={styles.extras}>
        {face.kind === 'gear' && <Text style={styles.details}>{face.data.slot} · {face.data.traits.join(' · ')}</Text>}
        {[...new Set([...links.keywords, ...strings(face.data.keywords)])].filter(name => keywordRepository.resolve(name)).length > 0 && <View style={styles.detailGroup}>
          <Text accessibilityRole="header" style={styles.groupTitle}>Keywords</Text><View style={styles.actions}>
            {[...new Set([...links.keywords, ...strings(face.data.keywords)])].filter(name => keywordRepository.resolve(name)).map(name => <Button key={name} quiet label={name} onPress={() => showKeyword(name)} />)}
          </View>
        </View>}
        {links.references.length > 0 && <View style={styles.detailGroup}><Text accessibilityRole="header" style={styles.groupTitle}>Referenced cards</Text><View style={styles.actions}>
          {links.references.map(link => <Button key={link.id} quiet label={link.name || link.id} onPress={() => openReference(link.id)} />)}
        </View></View>}
      </View>}
    </>;
  const keywordContent = definition && <>
      {definition.auto && <Text style={styles.details}>Auto- makes the following ability trigger during the first ability window instead of the listed timing.</Text>}
      <RichParagraph paragraph={definition.main} inlineGates size={16} align="left" {...textActions} />
      {definition.sections.map((section, index) => <View key={index} style={styles.detailGroup}><Text style={styles.groupTitle}>{section.title}</Text>
        {section.content ? <RichParagraph paragraph={section.content} inlineGates size={16} align="left" {...textActions} /> : <Text style={styles.details}>Definition not supplied.</Text>}
      </View>)}
    </>;
  const referenceContent = resolution && <>
      {resolution.status === 'missing' ? <Text style={styles.details}>This reference is missing from the bundled catalogue.</Text> : resolution.status === 'ambiguous' ? <>
        <Text style={styles.details}>This ID matches more than one card. Choose a reference.</Text>
        {resolution.cards.map(candidate => <Button key={candidate.id} quiet label={spoilers.hidden(candidate) ? `Unrevealed card · ${candidate.family} · ${candidate.faces[0].cycle}` : `${candidate.faces[0].name} · ${candidate.family} · ${candidate.faces[0].cycle}`} onPress={() => {
          navigate(candidate, faceForReference(candidate, reference!).id);
        }} />)}
      </> : null}
    </>;
  if (embedded) return <View style={styles.embeddedPage}>{body}
    {keyword && definition && <View style={styles.detailGroup}><Text style={styles.groupTitle}>{keyword}</Text>{keywordContent}<Button quiet label="Close keyword" onPress={() => setKeyword(null)} /></View>}
    {reference && resolution && <View style={styles.detailGroup}><Text style={styles.groupTitle}>Referenced card · {reference}</Text>{referenceContent}<Button quiet label="Close reference" onPress={() => setReference(null)} /></View>}
  </View>;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>{body}</ScrollView>
    {keyword && definition && <Sheet visible title={keyword} subtitle={definition.title !== keyword ? definition.title : undefined} onClose={() => setKeyword(null)}>{keywordContent}</Sheet>}
    {reference && resolution && <Sheet visible title="Referenced card" subtitle={reference} onClose={() => setReference(null)}>{referenceContent}</Sheet>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas }, page: { padding: 16, paddingBottom: 40, gap: 24, width: '100%', maxWidth: 900, marginHorizontal: 'auto' }, embeddedPage: { gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, eyebrow: { fontSize: 10, letterSpacing: 1.8, color: theme.muted },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, title: { color: theme.ink, fontFamily: theme.serif, fontSize: 28 }, subtitle: { fontSize: 12, color: theme.muted, lineHeight: 18, marginTop: 6 },
  presentation: { alignItems: 'center' }, extras: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 24 }, details: { color: theme.ink, fontSize: 14, lineHeight: 22 },
  detailGroup: { gap: 12 }, groupTitle: { fontFamily: theme.serif, color: theme.ink, fontSize: 20 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  referenceCard: { backgroundColor: '#DFDBCD', borderRadius: 10, padding: 16, gap: 20 }, referenceTitle: { fontSize: 22, color: theme.ink, textAlign: 'center' },
});
