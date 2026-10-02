import { isRecord } from './json.ts';

export function createKeywordRepository(input: Record<string, unknown>) {
  const normalise = (name: string) => name.toLowerCase().replace(/[‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = new Map<string, string>();
  for (const [name, data] of Object.entries(input)) {
    aliases.set(normalise(name), name);
    if (isRecord(data)) for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('subName') && typeof value === 'string') aliases.set(normalise(value), name);
    }
  }
  return {
    resolve(label: string) {
      const auto = /^auto-/i.test(label), name = label.replace(/^auto-/i, '').toLowerCase();
      const parameterised = name.replace(/[+−-]?\d+(?:\s*[–-]\s*\d+)?/g, 'x');
      const candidates = [name, `${name} x`, parameterised, parameterised.replace(/ x$/, ' x/+x'), `${name} x/+x`, `${name} (x)`, name.split(' ').slice(1).join(' '), name.startsWith('ranged') ? 'ranged y–x' : ''];
      const title = candidates.map(candidate => aliases.get(normalise(candidate))).find(Boolean);
      const data = title && input[title];
      if (!title || !isRecord(data)) return undefined;
      return { title: `${auto ? 'Auto-' : ''}${title}`, auto, main: data.mainDef,
        sections: Object.entries(data).filter(([key]) => key.startsWith('subName')).map(([key, value]) => ({ title: String(value), content: data[key.replace('subName', 'subDef')] })) };
    },
  };
}
