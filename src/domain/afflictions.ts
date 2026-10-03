import type { Argonaut } from './party.ts';

/** Reference descriptions supplied for the tracker; gameplay effects remain manual. */
export const AFFLICTIONS = [
  { id: 'mazetouched', name: 'Mazetouched', cycle: 1, description: 'Restricts safe navigation pathways in the Labyrinthuous; triggers severe penalties/sanity loss during specific Labyrinth tile-reveal story events.' },
  { id: 'consumed-by-rage', name: 'Consumed by Rage', cycle: 2, description: 'Lowers the threshold required to trigger narrative breakdown events; forces aggressive choices in Adventure Matrix branches.' },
  { id: 'black-breath', name: 'Black Breath', cycle: 2, description: 'Stacks environmental corruption; penalizes exploration checks and limits recovery actions during the Voyage phase.' },
  { id: 'fractured', name: 'Fractured', cycle: 3, description: 'Permanently limits specific Argonaut traits or increases the danger rating during Trauma checks if pushed too far.' },
  { id: 'moirai-mistake', name: 'Moirai Mistake', cycle: 3, description: 'Forces the automatic failure or disadvantageous rerolls of Fate checks during critical story crossroads.' },
  { id: 'abyss-curse', name: 'Abyss Curse', cycle: 4, description: 'Imposes structural penalties to Hull or Crew health when passing through deep sea/ocean hazard spaces on the map.' },
  { id: 'goldthirst-curse', name: 'Goldthirst Curse', cycle: 4, description: 'Forces the collection of Greed tokens, draining the collective resource economy and penalizing diplomatic relations.' },
  { id: 'pursuer-curse', name: 'Pursuer Curse', cycle: 4, description: 'Dictates the aggressive AI movement of specific Nemesis primordials on the map, forcing unavoidable or ambushed battles.' },
  { id: 'windblight-curse', name: 'Windblight Curse', cycle: 4, description: 'Modifies the Voyage phase by locking down movement efficiency or draining extra actions to navigate storm-ridden tiles.' },
  { id: 'truth-of-the-primal-dark', name: 'Truth of the Primal Dark', cycle: 5, description: 'Blindness/void hazards that cut off certain scouting mechanics or standard choices in pitch-black terrain.' },
  { id: 'truth-of-imminent-drowning', name: 'Truth of Imminent Drowning', cycle: 5, description: 'Puts a strict timeline or action penalty on exploration tasks, simulating intense physical suffocation or pressure.' },
  { id: 'truth-of-the-inevitable-failure', name: 'Truth of the Inevitable Failure', cycle: 5, description: 'Artificially inflates the Campaign Doom track or advances bad timeline thresholds faster.' },
  { id: 'truth-of-eternal-loneliness', name: 'Truth of Eternal Loneliness', cycle: 5, description: 'Disallows the use of specific cooperative party boons or Kratos token sharing mechanics.' },
  { id: 'truth-of-the-unbearable-responsibility', name: 'Truth of the Unbearable Responsibility', cycle: 5, description: 'Increases the collective mental stress or sanity burden required by the leader/active Argonaut to pass checks.' },
] as const;

export type AfflictionId = typeof AFFLICTIONS[number]['id'];
export function isAfflictionId(value: unknown): value is AfflictionId {
  return AFFLICTIONS.some(affliction => affliction.id === value);
}
export function afflictionRecords(argonaut: Argonaut) {
  return (argonaut.afflictions ?? []).flatMap(id => {
    const definition = AFFLICTIONS.find(affliction => affliction.id === id);
    return definition ? [definition] : [];
  });
}
