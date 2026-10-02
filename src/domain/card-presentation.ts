import type { CardDefinition, CardFace } from './cards.ts';
import { isRecord, visitJson } from './json.ts';
import type { JsonObject, JsonValue } from './json.ts';

export const displayValue = (value: unknown): string => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export const objects = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter(isRecord) as JsonObject[] : [];
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(displayValue) : [];

export interface DisplayGate { type: string; value: string; type2?: string; value2?: string; combo?: string }
export function displayGate(value: unknown): DisplayGate | null {
  if (!isRecord(value)) return null;
  const type = displayValue(value.type ?? value.gate);
  return type ? { type, value: displayValue(value.value), type2: displayValue(value.type2 ?? value.gate2) || undefined,
    value2: displayValue(value.value2) || undefined, combo: displayValue(value.comboGate) || undefined } : null;
}
export function gateLabel(gate: DisplayGate): string {
  return `${gate.type} ${gate.value}${gate.type2 ? ` ${gate.combo === 'OR' ? 'or' : 'and'} ${gate.type2} ${gate.value2 || gate.value}` : ''}`.trim();
}
export function overheadGate(group: JsonObject, groupCount: number): boolean {
  const first = objects(group.abilities)[0], tokens = objects(first?.abilityText);
  return groupCount === 1 && (group.comboGate === 'OR' || tokens.length > 5 || displayValue(tokens[0]?.value).length > 15);
}
export function gearTitleSize(name: string): number { return Math.min(19, 300 / (1.2 * Math.max(1, name.length))); }
export function diceLayers(dice: readonly string[]) {
  return dice.map((name, depth) => {
    const direction = depth % 2 === 0 ? -1 : 1, scale = 1 - 0.05 * depth;
    return { name: `${direction > 0 ? 'Reversed' : ''}${name}`, x: depth === dice.length - 1 && direction === -1 ? 0 : direction * (9 - depth),
      y: -8 * Math.floor(depth / 2) * scale - 2 * depth + 4 * Math.floor((dice.length - 1) / 2),
      em: (1 + 0.1 * (3 - Math.floor(depth / 2))) * scale, zIndex: 100 - depth };
  });
}

export type RichSegment = { kind: 'text'; text: string; format?: string; reference?: string; keyword?: string }
  | { kind: 'icon'; name: string } | { kind: 'gate'; gate: DisplayGate };
export interface RichWord { segments: RichSegment[]; spaceAfter: boolean }
export interface RichParagraph { blocks: RichWord[][]; label: string; diagnostics: string[] }

/** A wrapping word flow keeps SVGs outside native Text while retaining token order and punctuation. */
export function formatParagraph(paragraph: unknown, inlineGates = false): RichParagraph {
  const blocks: RichWord[][] = [[]], diagnostics: string[] = [];
  let space = true;
  const current = () => blocks[blocks.length - 1];
  function line() { if (current().length) blocks.push([]); space = true; }
  function add(segment: RichSegment) {
    if (space || !current().length) current().push({ segments: [], spaceAfter: false });
    current().at(-1)!.segments.push(segment); space = false;
  }
  function whitespace() { if (current().length) current().at(-1)!.spaceAfter = true; space = true; }
  function text(value: unknown, detail: Partial<Extract<RichSegment, { kind: 'text' }>> = {}) {
    displayValue(value).split(/(\s+)/).filter(Boolean).forEach(part => {
      if (/^\s+$/.test(part)) whitespace(); else add({ ...detail, kind: 'text', text: part });
    });
  }
  const sentences = Array.isArray(paragraph) ? paragraph : paragraph == null ? [] : [paragraph];
  sentences.forEach((sentence, index) => {
    if (typeof sentence === 'string') { text(sentence); return; }
    if (!isRecord(sentence) || !Array.isArray(sentence.abilityText)) {
      diagnostics.push('Unrecognised ability shape'); text(sentence); return;
    }
    const tokens = objects(sentence.abilityText), first = tokens[0];
    if (index > 0 && (first?.type === 'timing' || sentence.costs || (inlineGates && sentence.gate))) line();
    const gate = inlineGates ? displayGate(sentence) : null;
    if (gate) { add({ kind: 'gate', gate }); whitespace(); }
    const reaction = first?.type === 'timing' && first.value === 'Reaction';
    if (reaction) { add({ kind: 'icon', name: 'Reaction' }); whitespace(); }
    strings(sentence.costs).forEach(name => { add({ kind: 'icon', name }); whitespace(); });
    tokens.forEach((token, tokenIndex) => {
      const type = displayValue(token.type);
      switch (type) {
        case 'newline': line(); break;
        case 'icon': add({ kind: 'icon', name: displayValue(token.value) }); break;
        case 'timing': if (!(reaction && tokenIndex === 0)) text(`${displayValue(token.value)}:`, { format: 'bold' }); break;
        case 'keyword': text(token.value, { keyword: displayValue(token.value) }); break;
        case 'cardRef': text(token.value, { format: 'italics', reference: displayValue(token.refID) || undefined }); break;
        case 'bold': case 'italics': text(token.value, { format: type }); break;
        case 'plainText': case 'whitespace': text(token.value); break;
        default: diagnostics.push(`Unrecognised token: ${type || '(no type)'}`); text(token.value ?? token);
      }
    });
    // ATCC emits a literal period and space after each structured sentence.
    text('. ');
  });
  const nonempty = blocks.filter(block => block.length);
  return { blocks: nonempty, diagnostics, label: nonempty.map(block => block.map(word => word.segments.map(segment =>
    segment.kind === 'text' ? segment.text : segment.kind === 'icon' ? `[${segment.name}]` : `[${gateLabel(segment.gate)}]`).join('') + (word.spaceAfter ? ' ' : '')).join('')).join('\n').trim() };
}

export function isSecretCard(card: CardDefinition): boolean {
  return card.faces.some(face => { const found = displayValue(face.data.foundIn); return found.includes('Secret Deck') || found.includes('Envelope') || found === 'Ultra-secret'; });
}
export function secretLabel(card: CardDefinition): string {
  const data = card.faces.find(face => face.data.foundIn)?.data || card.faces[0].data;
  return `${displayValue(data.foundIn) || 'Secret card'}${data.secretCardNumber ? ` · Card ${displayValue(data.secretCardNumber)}` : ''}`;
}
export function faceForReference(card: CardDefinition, alias: string): CardFace {
  const matches = card.faces.filter(face => face.printedIds.some(id => id.toUpperCase() === alias.trim().toUpperCase()));
  return matches.length === 1 ? matches[0] : card.faces[0];
}
export function cardLinks(face: CardFace) {
  const references = new Map<string, string>(), keywords = new Set<string>();
  visitJson(face.data as JsonValue, token => {
    if (token.type === 'cardRef' && typeof token.refID === 'string' && token.refID.trim()) references.set(token.refID, displayValue(token.value));
    if (token.type === 'keyword' && typeof token.value === 'string') keywords.add(token.value);
  });
  return { references: [...references].map(([id, name]) => ({ id, name })), keywords: [...keywords] };
}
