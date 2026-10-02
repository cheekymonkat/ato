/** Values retained without interpreting game rules or changing number-like strings. */
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function escapePointer(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function visitJson(value: JsonValue, visitor: (object: JsonObject, path: string) => void, path = ''): void {
  if (Array.isArray(value)) value.forEach((child, index) => visitJson(child, visitor, `${path}/${index}`));
  else if (isRecord(value)) {
    visitor(value as JsonObject, path);
    Object.entries(value).forEach(([key, child]) => visitJson(child as JsonValue, visitor, `${path}/${escapePointer(key)}`));
  }
}
