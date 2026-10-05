import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AppHeader } from '../navigation/AppHeader';
import { theme } from '../theme/tokens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PartyProvider } from '../state/PartyProvider';
import { SpoilerProvider } from '../state/SpoilerProvider';
import { KeywordHelpProvider } from '../components/KeywordHelpContext';
import { KeywordHelpOverlay } from '../components/KeywordHelpOverlay';

export default function RootLayout() {
  return <SafeAreaProvider><PartyProvider><SpoilerProvider><KeywordHelpProvider><StatusBar style="light" /><SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.charcoal }}><AppHeader /><View style={{ flex: 1, minWidth: 0, backgroundColor: theme.canvas }}><Slot /></View></SafeAreaView><KeywordHelpOverlay modal /></KeywordHelpProvider></SpoilerProvider></PartyProvider></SafeAreaProvider>;
}
