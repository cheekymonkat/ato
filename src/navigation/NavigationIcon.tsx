import Svg, { Path } from 'react-native-svg';
import type { Destination } from './destinations';
const paths: Record<Destination, string> = {
  Argo: 'M12 3v10M12 3l6 7h-6M9 5l-5 6h5V5M3 14l3 5h12l3-5H3M2 21q2-2 4 0t4 0t4 0t4 0t4 0',
  Map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6M9 3v15M15 6v15',
  Cargo: 'M3 7l9-4 9 4v11l-9 4-9-4V7M3 7l9 4 9-4M12 11v11M7 5l9 4',
  Technology: 'M9 2h6v6H9V2M2 16h6v6H2v-6M16 16h6v6h-6v-6M5 16v-4h14v4M12 8v4',
  Argonauts: 'M8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M16 4a3 3 0 1 1 0 6M2 21v-4a6 6 0 0 1 12 0v4M17 13a5 5 0 0 1 5 5v3',
  Timeline: 'M5 4v16M4 4h2M4 12h2M4 20h2M10 4h11M10 12h11M10 20h11',
};
export function NavigationIcon({ name, colour }: { name: Destination; colour: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden><Path d={paths[name]} stroke={colour} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>;
}
