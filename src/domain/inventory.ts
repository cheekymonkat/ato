import type { CardDefinition } from './cards.ts';
import type { Party, Argonaut, CampaignInventory } from './party.ts';
import type { CatalogueRepository } from '../catalogue/repository.ts';
import { campaignCycle, isFaceAvailableInCycle } from './campaign.ts';
import { isDreamwalker } from './titan-selection.ts';

/** Count physical instances, including Gear awaiting reassignment. Two-hand assignments count once. */
export function allocatedGear(party: Pick<Party, 'argonauts'>, catalogue: CatalogueRepository): Record<string, number> {
  const entries = new Map<string, number>();
  for (const member of party.argonauts) for (const instance of member.instances) {
    const card = catalogue.get(instance.definitionId);
    if (card?.family === 'Gear' || !card && member.equipment.some(entry => entry.instanceId === instance.id)) {
      entries.set(instance.definitionId, (entries.get(instance.definitionId) ?? 0) + 1);
    }
  }
  return Object.fromEntries(entries);
}
export function inventoryFor(party: Party, catalogue: CatalogueRepository): CampaignInventory {
  return party.inventory ?? { version: 1, enforce: false, gear: allocatedGear(party, catalogue),
    titans: [...new Set(party.argonauts.flatMap(member => member.titan ? [member.titan.definitionId] : []))] };
}
export function ownedGear(party: Party, id: string, catalogue: CatalogueRepository): number {
  const gear = inventoryFor(party, catalogue).gear;
  return Object.hasOwn(gear, id) ? gear[id] : 0;
}
export function gearStock(party: Party, id: string, catalogue: CatalogueRepository) {
  const owned = ownedGear(party, id, catalogue), counts = allocatedGear(party, catalogue);
  const allocated = Object.hasOwn(counts, id) ? counts[id] : 0;
  return { owned, allocated, available: Math.max(0, owned - allocated) };
}
/** Printed front/back IDs describe the same supply. Ambiguous aliases never imply extra copies. */
export function physicalGearLimit(card: CardDefinition, catalogue: CatalogueRepository): number | null {
  const ids = [...new Set(card.printedIds.map(id => id.trim().toUpperCase()).filter(Boolean))];
  if (!ids.length || card.family !== 'Gear') return null;
  const games = new Set(card.faces.map(face => face.game));
  if (ids.some(id => catalogue.byPrintedId(id).some(other => other.id !== card.id && other.family === 'Gear' && other.faces.some(face => games.has(face.game))))) return null;
  return ids.length;
}
/** Only increased allocations are constrained, so old overages can always be repaired or removed. */
export function inventoryAllowsEquipment(party: Party, before: Argonaut, after: Argonaut, catalogue: CatalogueRepository): boolean {
  if (!party.inventory?.enforce) return true;
  const previous = allocatedGear(party, catalogue);
  const proposed = allocatedGear({ argonauts: party.argonauts.map(member => member.id === before.id ? after : member) }, catalogue);
  return Object.entries(proposed).every(([id, count]) => {
    if (count <= (Object.hasOwn(previous, id) ? previous[id] : 0)) return true;
    return count <= ownedGear(party, id, catalogue) && after.instances.filter(instance => instance.definitionId === id)
      .every(instance => isFaceAvailableInCycle(catalogue.getFace(id, instance.faceId), campaignCycle(party)));
  });
}
export function inventoryAllowsTitan(party: Party, id: string, faceId: string, catalogue: CatalogueRepository): boolean {
  const face = catalogue.getFace(id, faceId);
  return face?.kind === 'titan' && isFaceAvailableInCycle(face, campaignCycle(party)) &&
    (!party.inventory?.enforce || isDreamwalker(face) || party.inventory.titans.includes(id));
}
export function inventoryNotices(party: Party, catalogue: CatalogueRepository): string[] {
  const inventory = inventoryFor(party, catalogue), assigned = allocatedGear(party, catalogue), notices: string[] = [];
  for (const id of new Set([...Object.keys(inventory.gear), ...Object.keys(assigned)])) {
    const card = catalogue.get(id), owned = ownedGear(party, id, catalogue), count = Object.hasOwn(assigned, id) ? assigned[id] : 0;
    if (!card || card.family !== 'Gear') { notices.push(`Unavailable inventory Gear: ${id}. Keep this record until the catalogue is corrected.`); continue; }
    const limit = physicalGearLimit(card, catalogue);
    if (count > owned) notices.push(`${card.faces[0].name}: ${count} allocated, but only ${owned} acquired. Review the loadouts or acquired count.`);
    if (limit === null && owned > 0) notices.push(`${card.faces[0].name}: printed supply is unknown or ambiguous; verify the acquired copies manually.`);
    if (limit !== null && owned > limit) notices.push(`${card.faces[0].name}: ${owned} acquired exceeds the ${limit} distinct printed IDs. Existing copies have been preserved.`);
  }
  return notices;
}
