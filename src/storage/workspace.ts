import type { CatalogueRepository } from '../catalogue/repository.ts';
import { assert, isJsonValue, isRecord } from '../domain/json.ts';
import { createParty, parseParty } from '../domain/party.ts';
import type { Party } from '../domain/party.ts';

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

export function newProfile(id: string, name: string, catalogueVersion: string): PartyProfile {
  return { id, name: profileName(name), party: createParty(id, ['arg-1', 'arg-2', 'arg-3', 'arg-4'], catalogueVersion) };
}

function parseProfile(value: unknown): PartyProfile {
  assert(isRecord(value) && typeof value.id === 'string' && value.id.trim(), 'Invalid profile identity.');
  assert(typeof value.name === 'string' && profileName(value.name) === value.name, 'Invalid profile name.');
  const party = parseParty(value.party);
  assert(party.id === value.id, 'Party and profile identities do not match.');
  return value as unknown as PartyProfile;
}

/** Explicit migration from standalone schema-1 parties; future versions must add a migration here. */
export function parseWorkspace(value: unknown): Workspace {
  if (isRecord(value) && value.saveSchemaVersion === 1) {
    const party = parseParty(value);
    return { format: 'ato-workspace', schemaVersion: 1, activeProfileId: party.id, profiles: [{ id: party.id, name: 'My expedition', party }] };
  }
  assert(isRecord(value) && isJsonValue(value) && value.format === 'ato-workspace' && value.schemaVersion === 1, 'Unsupported local save version or non-JSON state.');
  assert(Array.isArray(value.profiles) && value.profiles.length > 0, 'The save contains no profiles.');
  const profiles = value.profiles.map(parseProfile);
  assert(new Set(profiles.map(profile => profile.id)).size === profiles.length, 'Duplicate profile identities.');
  assert(typeof value.activeProfileId === 'string' && profiles.some(profile => profile.id === value.activeProfileId), 'Invalid active profile.');
  return value as unknown as Workspace;
}

export function referenceProblems(party: Party, catalogue: CatalogueRepository): string[] {
  const problems: string[] = [];
  for (const member of party.argonauts) {
    if (member.argonautDefinitionId && !catalogue.get(member.argonautDefinitionId)) problems.push(`${member.name}: missing Argonaut ${member.argonautDefinitionId}`);
    for (const instance of [...member.instances, ...(member.titan ? [member.titan] : [])]) {
      const definition = catalogue.get(instance.definitionId);
      const prefix = `${member.name} / ${instance.id}`;
      if (!definition) { problems.push(`${prefix}: missing card ${instance.definitionId}`); continue; }
      const face = catalogue.getFace(instance.definitionId, instance.faceId);
      if (!face) problems.push(`${prefix}: missing ${instance.faceId} face`);
      if (instance === member.titan && face?.family !== 'Titan') problems.push(`${prefix}: the selected Titan is not a Titan card`);
      const effects = new Set(definition.faces.flatMap(face => face.slotEffects.map(effect => effect.id)));
      for (const effect of new Set([...instance.enabledEffectIds, ...(instance.satisfiedEffectIds || [])])) {
        if (!effects.has(effect)) problems.push(`${prefix}: missing effect ${effect}`);
      }
    }
  }
  return problems;
}

export function exportProfile(profile: PartyProfile): string {
  parseProfile(profile);
  return JSON.stringify({ format: 'ato-party-backup', backupVersion: 1, exportedAt: new Date().toISOString(), profile }, null, 2);
}

/** Validation never changes the current workspace. Unresolved references block import, with a complete report. */
export function readBackup(text: string, catalogue: CatalogueRepository): { profile: PartyProfile; warnings: string[] } {
  assert(utf8Size(text) <= MAX_BACKUP_BYTES, 'Backup exceeds the 5 MB limit.');
  const value: unknown = JSON.parse(text);
  let profile: PartyProfile;
  if (isRecord(value) && value.saveSchemaVersion === 1) {
    const party = parseParty(value);
    profile = { id: party.id, name: 'Imported expedition', party };
  } else {
    assert(isRecord(value) && value.format === 'ato-party-backup' && value.backupVersion === 1, 'Unsupported backup format or version.');
    profile = parseProfile(value.profile);
  }
  const problems = referenceProblems(profile.party, catalogue);
  assert(!problems.length, `Backup has unresolved references:\n${problems.join('\n')}`);
  return { profile, warnings: profile.party.catalogueVersion === catalogue.version ? [] : ['This backup uses a different catalogue version. Capacity will be recalculated using the installed catalogue.'] };
}

export function importProfile(workspace: Workspace, source: PartyProfile, id: string, name: string): Workspace {
  assert(!workspace.profiles.some(profile => profile.id === id), 'The new profile identity already exists.');
  const profile = parseProfile({ id, name: profileName(name), party: { ...source.party, id } });
  return parseWorkspace({ ...workspace, activeProfileId: id, profiles: [...workspace.profiles, profile] });
}
