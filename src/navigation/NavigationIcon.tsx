import { MenuIcon } from '../components/Icon';
import type { MenuIconName } from '../components/Icon';
import type { Destination } from './destinations';
const icons: Record<Destination, MenuIconName> = {
  Argo: 'Argo',
  Map: 'Map',
  Cargo: 'CargoHold',
  Technology: 'Technology',
  Argonauts: 'Argonauts',
  Timeline: 'Timeline',
};
export function NavigationIcon({ name, colour }: { name: Destination; colour: string }) {
  return <MenuIcon name={icons[name]} size={24} colour={colour} />;
}
