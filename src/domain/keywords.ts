import { isRecord } from './json.ts';

export function createKeywordRepository(input: Record<string, unknown>) {
  const normalise = (name: string) => name.toLowerCase().replace(/[‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = new Map<string, { title: string; subKey?: string }>();
  // Build primary names first so an exact subname takes priority even if it is also a primary name.
  for (const name of Object.keys(input)) aliases.set(normalise(name), { title: name });
  for (const [name, data] of Object.entries(input)) {
    if (isRecord(data)) for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('subName') && typeof value === 'string') aliases.set(normalise(value), { title: name, subKey: key });
    }
  }
  return {
    resolve(label: string) {
      const cleaned = label.trim(), auto = /^auto-/i.test(cleaned), name = cleaned.replace(/^auto-/i, '').toLowerCase();
      const parameterised = name.replace(/[+−-]?\d+(?:\s*[–-]\s*\d+)?/g, 'x');
      const candidates = [name, `${name} x`, parameterised, parameterised.replace(/ x$/, ' x/+x'), `${name} x/+x`, `${name} (x)`, name.split(' ').slice(1).join(' '), name.startsWith('ranged') ? 'ranged y–x' : ''];
      const match = candidates.map(candidate => aliases.get(normalise(candidate))).find(Boolean);
      const title = match?.title;
      const data = title && input[title];
      if (!title || !isRecord(data)) return undefined;
      if (match.subKey) {
        const content = data[match.subKey.replace('subName', 'subDef')];
        if (content !== undefined && content !== null && content !== '' && (!Array.isArray(content) || content.length > 0)) {
          return { title: `${auto ? 'Auto-' : ''}${String(data[match.subKey])}`, auto, main: content, sections: [] };
        }
      }
      return { title: `${auto ? 'Auto-' : ''}${title}`, auto, main: data.mainDef,
        sections: Object.entries(data).filter(([key]) => key.startsWith('subName')).map(([key, value]) => ({ title: String(value), content: data[key.replace('subName', 'subDef')] })) };
    },
  };
}
