import { inventoryNotices } from '../domain/inventory.ts';
import type { CatalogueRepository } from '../catalogue/repository.ts';
import { assert, isJsonValue, isRecord } from '../domain/json.ts';
import { createParty, parseParty } from '../domain/party.ts';
import { isCampaignCycle } from '../domain/campaign.ts';
import type { CampaignCycle } from '../domain/campaign.ts';
import type { Party } from '../domain/party.ts';
import { supportsPattern } from '../domain/references.ts';
import { duplicateMemories, memoryFamily } from '../domain/memories.ts';
import { conditionConflict, conditionRecords, supportsCondition } from '../domain/conditions.ts';

export interface PartyProfile { id: string; name: string; party: Party }
export interface Workspace { format: 'ato-workspace'; schemaVersion: 1; activeProfileId: string; profiles: PartyProfile[] }
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
function utf8Size(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function profileName(name: string): string {
  assert(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 80, 'Give the party a name of 1–80 characters.');
  return name.trim();
}

export function newProfile(id: string, name: string, catalogueVersion: string, cycle: CampaignCycle = 1, inventoryTracking = false): PartyProfile {
  assert(isCampaignCycle(cycle), 'Choose a campaign cycle from 1 to 5.');
  assert(typeof inventoryTracking === 'boolean', 'Choose whether campaign inventory tracking is enabled.');
  return { id, name: profileName(name), party: { ...createParty(id, ['arg-1', 'arg-2', 'arg-3', 'arg-4'], catalogueVersion), campaignCycle: cycle,
    ...(inventoryTracking ? { inventory: { version: 1 as const, enforce: true, gear: {}, titans: [] } } : {}) } };
}

function parseProfile(value: unknown): PartyProfile {
  assert(isRecord(value) && typeof value.id === 'string' && value.id.trim(), 'Invalid profile identity.');
  assert(typeof value.name === 'string' && profileName(value.name) === value.name, 'Invalid profile name.');
  const party = parseParty(value.party);
  assert(party.id === value.id, 'Party and profile identities do not match.');
  return { ...value, party } as unknown as PartyProfile;
}

/** Envelope version is independent of the nested party schema and its migrations. */
export function parseWorkspace(value: unknown): Workspace {
  if (isRecord(value) && Object.hasOwn(value, 'saveSchemaVersion')) {
    const party = parseParty(value);
    return { format: 'ato-workspace', schemaVersion: 1, activeProfileId: party.id, profiles: [{ id: party.id, name: 'My expedition', party }] };
  }
  assert(isRecord(value) && isJsonValue(value) && value.format === 'ato-workspace' && value.schemaVersion === 1, 'Unsupported local save version or non-JSON state.');
  assert(Array.isArray(value.profiles) && value.profiles.length > 0, 'The save contains no profiles.');
  const profiles = value.profiles.map(parseProfile);
  assert(new Set(profiles.map(profile => profile.id)).size === profiles.length, 'Duplicate profile identities.');
  assert(typeof value.activeProfileId === 'string' && profiles.some(profile => profile.id === value.activeProfileId), 'Invalid active profile.');
  return { ...value, profiles } as unknown as Workspace;
}

export function referenceProblems(party: Party, catalogue: CatalogueRepository): string[] {
  const problems: string[] = duplicateMemories(party).map(assignment => `${assignment.argonautName} / ${assignment.instance.id}: duplicate unique memory ${assignment.instance.definitionId}`);
  for (const id of party.technologies?.researched ?? []) if (catalogue.get(id)?.family !== 'Technology') problems.push(`Campaign technologies: unavailable Technology ${id}`);
  for (const [family, ids] of [['Gear', Object.keys(party.inventory?.gear ?? {})], ['Titan', party.inventory?.titans ?? []]] as const) {
    for (const id of ids) if (catalogue.get(id)?.family !== family) problems.push(`Campaign inventory: unavailable ${family} ${id}`);
  }
  for (const member of party.argonauts) {
    const conditions = conditionRecords(member);
    for (const condition of conditions) if (conditionConflict(conditions, condition, catalogue)) problems.push(`${member.name}: duplicate condition type ${condition.name}`);
    for (const condition of member.conditions ?? []) {
      const ref = condition.reference;
      if (ref && !supportsCondition(catalogue.getFace(ref.definitionId, ref.faceId))) problems.push(`${member.name}: unavailable condition ${ref.definitionId} / ${ref.faceId}`);
    }
    for (const kind of ['Trauma', 'Kratos'] as const) {
      const reference = member.tableOverrides[kind === 'Trauma' ? 'trauma' : 'kratos'];
      if (reference && !supportsPattern(catalogue.getFace(reference.definitionId, reference.faceId), kind)) problems.push(`${member.name}: unavailable ${kind} Pattern override ${reference.definitionId} / ${reference.faceId}`);
    }
    if (member.argonautDefinitionId && !catalogue.get(member.argonautDefinitionId)) problems.push(`${member.name}: missing Argonaut ${member.argonautDefinitionId}`);
    for (const instance of [...member.instances, ...(member.titan ? [member.titan] : [])]) {
      const definition = catalogue.get(instance.definitionId);
      const prefix = `${member.name} / ${instance.id}`;
      if (!definition) { problems.push(`${prefix}: missing card ${instance.definitionId}`); continue; }
      const face = catalogue.getFace(instance.definitionId, instance.faceId);
      if (!face) problems.push(`${prefix}: missing ${instance.faceId} face`);
      for (const kind of ['mnemos', 'fated-mnemos'] as const) if (member[kind === 'mnemos' ? 'mnemosIds' : 'fatedMnemosIds'].includes(instance.id) && face && face.family !== memoryFamily(kind)) problems.push(`${prefix}: expected a ${memoryFamily(kind)} card`);
      if (instance === member.titan && face?.family !== 'Titan') problems.push(`${prefix}: the selected Titan is not a Titan card`);
      const effects = new Set(definition.faces.flatMap(face => face.slotEffects.map(effect => effect.id)));
      for (const effect of new Set([...instance.enabledEffectIds, ...(instance.satisfiedEffectIds || [])])) {
        if (!effects.has(effect)) problems.push(`${prefix}: missing effect ${effect}`);
      }
    }
  }
  return problems;
}

/** Explicitly accept an installed catalogue after checking the current campaign. */
export function acknowledgeCatalogueUpdate(workspace: Workspace, profileId: string, expectedVersion: string, catalogue: CatalogueRepository): Workspace {
  const profile = workspace.profiles.find(profile => profile.id === profileId);
  assert(profile && workspace.activeProfileId === profileId, 'The campaign changed. Review its catalogue notices again.');
  assert(profile.party.catalogueVersion === expectedVersion, 'The catalogue notice changed. Review it again.');
  assert(referenceProblems(profile.party, catalogue).length === 0, 'Resolve the listed saved card issues before acknowledging this catalogue update.');
  if (profile.party.catalogueVersion === catalogue.version) return workspace;
  return { ...workspace, profiles: workspace.profiles.map(entry => entry.id === profileId
    ? { ...entry, party: { ...entry.party, catalogueVersion: catalogue.version } } : entry) };
}

export function exportProfile(profile: PartyProfile): string {
  const validated = parseProfile(profile);
  return JSON.stringify({ format: 'ato-party-backup', backupVersion: 1, exportedAt: new Date().toISOString(), profile: validated }, null, 2);
}

/** Validation never changes the current workspace. Unresolved references block import, with a complete report. */
export function readBackup(text: string, catalogue: CatalogueRepository): { profile: PartyProfile; warnings: string[] } {
  assert(utf8Size(text) <= MAX_BACKUP_BYTES, 'Backup exceeds the 5 MB limit.');
  const value: unknown = JSON.parse(text);
  let profile: PartyProfile;
  if (isRecord(value) && Object.hasOwn(value, 'saveSchemaVersion')) {
    const party = parseParty(value);
    profile = { id: party.id, name: 'Imported expedition', party };
  } else {
    assert(isRecord(value) && value.format === 'ato-party-backup' && value.backupVersion === 1, 'Unsupported backup format or version.');
    profile = parseProfile(value.profile);
  }
  const problems = referenceProblems(profile.party, catalogue);
  assert(!problems.length, `Backup has invalid or unresolved references:\n${problems.join('\n')}`);
  return { profile, warnings: [...(profile.party.catalogueVersion === catalogue.version ? [] : ['This backup uses a different catalogue version. Capacity will be recalculated using the installed catalogue.']), ...(profile.party.inventory ? inventoryNotices(profile.party, catalogue) : [])] };
}

export function importProfile(workspace: Workspace, source: PartyProfile, id: string, name: string): Workspace {
  assert(!workspace.profiles.some(profile => profile.id === id), 'The new profile identity already exists.');
  const profile = parseProfile({ id, name: profileName(name), party: { ...source.party, id } });
  assert(duplicateMemories(profile.party).length === 0, 'Each Mnemos or Fated Mnemos card is unique across the party. Remove duplicate memories before importing.');
  return parseWorkspace({ ...workspace, activeProfileId: id, profiles: [...workspace.profiles, profile] });
}
