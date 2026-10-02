import { useLocalSearchParams } from 'expo-router';
import { GearLibrary } from '../cards/GearLibrary';

export default function GearScreen() {
  const { q, cycle, p } = useLocalSearchParams<{ q?: string; cycle?: string; p?: string }>();
  const page = Number(p || 0);
  return <GearLibrary initialQuery={q || ''} initialCycle={cycle || ''} initialPage={Number.isSafeInteger(page) && page >= 0 ? page : 0} />;
}
