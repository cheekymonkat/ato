import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PartyProvider } from '../state/PartyProvider';
import { SpoilerProvider } from '../state/SpoilerProvider';

export default function RootLayout() {
  return <SafeAreaProvider><PartyProvider><SpoilerProvider><StatusBar style="dark" /><Slot /></SpoilerProvider></PartyProvider></SafeAreaProvider>;
}
