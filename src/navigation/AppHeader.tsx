import { router, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { MenuIcon } from '../components/Icon';
import { DashboardMenu } from '../dashboard/DashboardMenu';
import { TidesOfFateDialog } from '../dashboard/TidesOfFateDialog';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { activeDestination, DESTINATIONS, destinationPath } from './destinations';
import { NavigationIcon } from './NavigationIcon';

export function AppHeader() {
  const { party, profile, dispatch } = useParty(), { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const width = Math.min(windowWidth, containerWidth ?? windowWidth);
  const pathname = usePathname(), active = activeDestination(pathname), compact = width < 860;
  const [menu, setMenu] = useState(false), [clearing, setClearing] = useState<{ partyId: string; argonautId: string; name: string } | null>(null);
  return <SafeAreaView edges={['left', 'right']} style={styles.header}>
    <View onLayout={event => { if (event.nativeEvent.layout.width > 0) setContainerWidth(event.nativeEvent.layout.width); }} style={[styles.row, compact && styles.wrap]}>
      <View style={styles.brand}><MenuIcon name="Argonauts" size={40} colour={theme.gold} /><View><Text style={styles.title}>AEON TRESPASS</Text><Text style={styles.subtitle}>O D Y S S E Y</Text></View></View>
      {compact && <Button quiet label="Open menu" onPress={() => setMenu(true)} style={[styles.menu, compact && styles.compactMenu]}>
        <View style={{ gap: 4 }}>{[0, 1, 2].map(key => <View key={key} style={styles.line} />)}</View>
      </Button>}
      <View accessibilityRole="tablist" style={[styles.navigation, compact && styles.compactNavigation]}>
        {DESTINATIONS.map(name => {
          const selected = active === name, colour = selected ? '#DCC38D' : '#D5D1C7';
          return <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name} accessibilityState={{ selected }}
            onPress={() => { if (pathname !== destinationPath(name, party.activeArgonautId)) router.replace(destinationPath(name, party.activeArgonautId) as Href); }}
            style={({ pressed }) => [styles.destination, compact && styles.compactDestination, selected && styles.selected, pressed && { opacity: 0.65 }]}>
            <NavigationIcon name={name} colour={colour} /><Text numberOfLines={1} style={[styles.label, { color: colour, fontSize: width < 380 ? 9 : 11 }]}>{name}</Text>
          </Pressable>;
        })}
      </View>

      {!compact && <Button quiet label="Open menu" onPress={() => setMenu(true)} style={[styles.menu, compact && styles.compactMenu]}>
        <View style={{ gap: 4 }}>{[0, 1, 2].map(key => <View key={key} style={styles.line} />)}</View>
      </Button>}
    </View>
    <DashboardMenu visible={menu} compact={compact} onClose={() => setMenu(false)}
      onBrowseGear={() => { setMenu(false); router.push('/gear'); }} onProfiles={() => { setMenu(false); router.push('/profiles'); }}
      onClearAll={() => { setMenu(false); setClearing({ partyId: party.id, argonautId: party.activeArgonautId, name: profile.name }); }} />
    {clearing && <TidesOfFateDialog campaignName={clearing.name} onClose={() => setClearing(null)} onConfirm={() => {
      dispatch({ type: 'clear-all', partyId: clearing.partyId, argonautId: clearing.argonautId, confirmed: true }); setClearing(null);
    }} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  header: { backgroundColor: theme.charcoal, flexShrink: 0 }, row: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 24, minHeight: 86 },
  wrap: { flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 }, title: { color: '#F1EBDE', fontFamily: theme.serif, fontSize: 16, letterSpacing: 2 },
  subtitle: { color: theme.gold, fontSize: 9, marginTop: 5 }, navigation: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  compactNavigation: { flexGrow: 0, flexShrink: 0, flexBasis: '100%', gap: 0 },
  destination: { paddingTop: 12, paddingBottom: 10, minHeight: 74, minWidth: 76, alignItems: 'center', justifyContent: 'center', gap: 6, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  compactDestination: { minWidth: 0, flex: 1, paddingHorizontal: 0, minHeight: 68 }, selected: { borderBottomColor: theme.gold, backgroundColor: '#42413D' },
  label: { fontSize: 11, fontWeight: '600' }, menu: { width: 44, padding: 0, borderColor: '#706D65' }, compactMenu: { marginLeft: 'auto' },
  line: { width: 20, height: 2, backgroundColor: '#F1EBDE' },
});
