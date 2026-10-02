import type { AbilityToken, CardFace, EffectCondition, SlotCapacityEffect } from '../domain/cards.ts';
import { isRecord } from '../domain/json.ts';
import type { JsonObject, JsonValue } from '../domain/json.ts';

export interface EffectDiagnostic { pointer: string; message: string }
export interface EffectResult { effects: SlotCapacityEffect[]; diagnostics: EffectDiagnostic[] }

/** Rendering may format each token separately. This is only an importer/search utility. */
export function tokenText(tokens: JsonValue): string {
  if (!Array.isArray(tokens)) return '';
  return tokens.map(token => isRecord(token) && typeof token.value === 'string' ? token.value : '').join(' ').replace(/\s+/g, ' ').trim();
}

/** Recognises a narrow audited grammar; icons must be icons, not words in prose. */
export function extractSlotEffects(face: CardFace, definitionId: string): EffectResult {
  const result: EffectResult = { effects: [], diagnostics: [] };
  if (face.kind !== 'gear') return result;
  const gearData = face.data;
  function walk(value: JsonValue, path: string, conditions: EffectCondition[]): void {
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}/${i}`, conditions)); return; }
    if (!isRecord(value)) return;
    const object = value as JsonObject;
    const gated = typeof object.gate === 'string'
      ? [...conditions, { type: 'gate' as const, gate: object.gate, value: typeof object.value === 'string' ? object.value : null }]
      : conditions;
    if (Array.isArray(object.abilityText)) {
      const text = tokenText(object.abilityText);
      if (/\badditional\b/i.test(text) && /\bslots?\b/i.test(text)) {
        const pointer = `${path}/abilityText`;
        const validTokens = object.abilityText.every(t => isRecord(t) && typeof t.type === 'string');
        const icons = object.abilityText.filter(t => isRecord(t) && t.type === 'icon').map(t => (t as JsonObject).value);
        const support = /^You have ([1-9]\d*) additional Support slots?(?: for a Gear with the ([\w -]+) Trait)?$/.exec(text);
        const hand = /^You may gain ([1-9]\d*) additional OneHanded slots? during Loadout$/.exec(text);
        const recognized = (support && icons.includes('Support') && (!support[2] || icons.includes('Gear'))) || (hand && icons.includes('OneHanded'));
        if (recognized && validTokens && !Object.hasOwn(object, 'costs')) {
          const amount = Number((support || hand)![1]);
          if (!Number.isSafeInteger(amount)) result.diagnostics.push({ pointer, message: 'Capacity amount is outside the supported integer range.' });
          else result.effects.push({ id: `${face.id}:capacity:${support ? 'support' : 'hand'}:${hand ? 'optional-loadout' : 'automatic'}:${encodeURIComponent(support?.[2] || 'any')}:${encodeURIComponent(JSON.stringify(gated))}`, type: 'slot-capacity', slot: support ? 'support' : 'hand', amount,
            source: { definitionId, faceId: face.id, pointer, tokens: object.abilityText as AbilityToken[] },
            activation: hand ? 'optional-loadout' : 'automatic',
            eligibility: support?.[2] ? { family: 'Gear', requiredTraits: [support[2]] } : null,
            conditions: gated, consequences: hand ? gearData.abilities.flatMap(ability => {
              if (!isRecord(ability)) return [];
              const consequence = tokenText(ability.abilityText as JsonValue);
              return consequence.startsWith('If you do,') ? [consequence] : [];
            }) : [] });
        } else result.diagnostics.push({ pointer, message: `Unmapped slot-capacity wording: ${text}` });
      }
    }
    Object.entries(object).forEach(([key, child]) => {
      if (key !== 'abilityText') walk(child, `${path}/${key}`, gated);
    });
  }
  // Do not treat FAQ, errata or flavour text as active abilities.
  walk(face.data.abilities, '/abilities', []);
  walk(face.data.gatedAbilities, '/gatedAbilities', []);
  return result;
}
