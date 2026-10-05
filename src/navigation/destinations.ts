export const DESTINATIONS = ['Argo', 'Map', 'Cargo', 'Technology', 'Argonauts', 'Timeline'] as const;
export type Destination = typeof DESTINATIONS[number];
export function destinationPath(destination: Destination, argonautId: string): string {
  return destination === 'Argonauts' ? `/argonaut/${encodeURIComponent(argonautId)}` : `/${destination.toLowerCase()}`;
}
export function activeDestination(path: string): Destination | null {
  if (/^\/(argonaut|loadout|memory)(\/|$)/.test(path) || path === '/') return 'Argonauts';
  if (/^\/(gear|cards)(\/|$)/.test(path)) return 'Cargo';
  return DESTINATIONS.find(destination => path === `/${destination.toLowerCase()}`) ?? null;
}
