import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PartyProvider } from '../state/PartyProvider';
import { SpoilerProvider } from '../state/SpoilerProvider';
import { KeywordHelpProvider } from '../components/KeywordHelpContext';
import { KeywordHelpOverlay } from '../components/KeywordHelpOverlay';

export default function RootLayout() {
  return <SafeAreaProvider><PartyProvider><SpoilerProvider><KeywordHelpProvider><StatusBar style="dark" /><Slot /><KeywordHelpOverlay modal /></KeywordHelpProvider></SpoilerProvider></PartyProvider></SafeAreaProvider>;
}
