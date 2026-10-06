import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { SwipeGuard } from '../components/SwipeSurface';
import { evaluateArgonautLikelihood } from '../domain/argonaut-likelihood';
import type { Party } from '../domain/party';
import { textOnColour, theme } from '../theme/tokens';

export function ArgonautTabs({ party, activeId, compact, onSelect }: {
  party: Pick<Party, 'argonauts' | 'order'>; activeId: string; compact: boolean; onSelect: (id: string) => void;
}) {
  const likelihood = useMemo(() => evaluateArgonautLikelihood(party.argonauts, getCatalogue()), [party.argonauts]);
  return <View style={styles.navigation}><View accessibilityRole="tablist" style={styles.tabs}>
    {party.order.map((id, index) => {
      const member = party.argonauts.find(entry => entry.id === id)!;
      const least = likelihood.leastIds.includes(id), most = likelihood.mostIds.includes(id);
      const labels = [least && `Least Likely${likelihood.leastIds.length > 1 ? ' (tied)' : ''}`,
        most && `Most Likely${likelihood.mostIds.length > 1 ? ' (tied)' : ''}`].filter(Boolean);
      const { cardCount, nodeCount } = likelihood.stats[id];
      return <View key={id} style={styles.slot}><SwipeGuard><Pressable accessibilityRole="tab"
        accessibilityLabel={`Argonaut ${index + 1}: ${member.name || `Argonaut ${index + 1}`}${labels.length ? `. ${labels.join(', ')}` : ''}. ${cardCount} standard Mnemos ${cardCount === 1 ? 'card' : 'cards'}, ${nodeCount} ${nodeCount === 1 ? 'node' : 'nodes'}`}
        accessibilityHint="Fewest or most standard Mnemos cards, then marked nodes. Resolve exact ties randomly when needed."
        accessibilityState={{ selected: id === activeId }} onPress={() => onSelect(id)}
        style={({ pressed }) => [styles.tab, compact && styles.smallTab, id === activeId && styles.selectedTab, pressed && { opacity: 0.65 }]}>
        <View style={[styles.heading, compact && styles.smallHeading]}>
          <View style={[styles.tabBadge, { backgroundColor: member.colour }]}><Text style={[styles.tabNumber, { color: textOnColour(member.colour) }]}>{index + 1}</Text></View>
          {!compact && <Text numberOfLines={1} style={[styles.tabLabel, id === activeId && styles.selectedLabel]}>{member.name || `Argonaut ${index + 1}`}</Text>}
        </View>
        <View style={[styles.indicators, compact && styles.smallIndicators]}>
          {least && <LikelihoodBadge kind="least" compact={compact} tied={likelihood.leastIds.length > 1} />}
          {most && <LikelihoodBadge kind="most" compact={compact} tied={likelihood.mostIds.length > 1} />}
        </View>
      </Pressable></SwipeGuard></View>;
    })}
  </View></View>;
}
function LikelihoodBadge({ kind, compact, tied }: { kind: 'least' | 'most'; compact: boolean; tied: boolean }) {
  return <View style={[styles.indicator, kind === 'least' ? styles.least : styles.most]}>
    <Text numberOfLines={1} style={[styles.indicatorText, { color: kind === 'least' ? '#315C7D' : '#725316' }]}>
      {kind === 'least' ? 'Least' : 'Most'}{compact ? '' : ' Likely'}{tied ? ' · tied' : ''}
    </Text>
  </View>;
}
const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', marginBottom: 24 }, tabs: { flex: 1, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.line },
  slot: { flex: 1, minWidth: 0 }, tab: { minHeight: 84, paddingVertical: 8, paddingHorizontal: 12, gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  heading: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 10 }, selectedTab: { borderBottomColor: theme.ink },
  tabBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, tabNumber: { fontSize: 11, fontWeight: '600' },
  tabLabel: { flex: 1, minWidth: 0, color: theme.muted, fontSize: 13 }, selectedLabel: { color: theme.ink, fontWeight: '600' },
  smallTab: { paddingHorizontal: 2 }, smallHeading: { justifyContent: 'center' },
  indicators: { minHeight: 36, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', alignItems: 'flex-start', gap: 2 }, smallIndicators: { justifyContent: 'center' },
  indicator: { maxWidth: '100%', borderWidth: 1, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  indicatorText: { fontSize: 10, lineHeight: 12, fontWeight: '600', flexShrink: 1 },
  least: { backgroundColor: '#E8EEF4', borderColor: '#B3C8D8' }, most: { backgroundColor: '#F3E8CF', borderColor: '#CEB77A' },
});
