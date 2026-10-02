import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PartyProvider } from '../state/PartyProvider';

export default function RootLayout() {
  return <SafeAreaProvider><PartyProvider><StatusBar style="dark" /><Slot /></PartyProvider></SafeAreaProvider>;
}
