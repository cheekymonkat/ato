#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const headers = ['Gear name', 'Cycle', 'Technology', 'Secret number', 'Missing side', 'Side name',
  'Available side', 'Acquisition', 'Printed IDs', 'Notes', 'Definition ID'];
const normalise = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cycleOrder = new Map(['Cycle I', 'Cycle II', 'Cycle III', 'Cycle IV', 'Cycle V', 'Mnestis Theatre'].map((cycle, index) => [cycle, index]));

/** Join recipes by printed ID first. A name fallback must identify exactly one definition in that cycle. */
export function missingGearRows(catalogue, availableFaces, skippedFaces = new Map()) {
  const gear = catalogue.cards.filter(card => card.faces.some(face => face.kind === 'gear')
    && !card.faces.some(face => String(face.data.foundIn ?? '').trim().toLowerCase() === 'promo'));
  const technologies = new Map();
  for (const technology of catalogue.cards.filter(card => card.family === 'Technology')) {
    for (const face of technology.faces) {
      for (const recipe of face.data.recipes ?? []) {
        const byId = recipe.refID ? gear.filter(card => card.printedIds.includes(recipe.refID)) : [];
        const byName = byId.length ? byId : gear.filter(card => card.faces.some(gearFace =>
          gearFace.cycle === face.cycle && normalise(gearFace.name) === normalise(recipe.name)));
        if (byName.length !== 1) continue;
        const names = technologies.get(byName[0].id) ?? new Set();
        names.add(technology.faces[0].name);
        technologies.set(byName[0].id, names);
      }
    }
  }
  const rows = [];
  for (const card of gear) {
    for (const face of card.faces.filter(face => face.kind === 'gear')) {
      const key = `${card.id}/${face.id}`;
      if (availableFaces.has(key)) continue;
      const available = card.faces.filter(other => other.kind === 'gear' && availableFaces.has(`${card.id}/${other.id}`));
      const secretNumber = face.data.secretCardNumber ?? card.faces.find(other => other.data.secretCardNumber)?.data.secretCardNumber ?? '';
      const notes = skippedFaces.get(key) ?? (face.name === 'Fists'
        ? 'Default unarmed gear; no supplied artwork is linked to this side.' : 'No supplied artwork is linked to this side.');
      rows.push([card.faces.find(other => other.kind === 'gear').name, face.cycle ?? '',
        [...(technologies.get(card.id) ?? [])].sort().join('; '), String(secretNumber),
        face.id === 'back' ? 'Flipped side' : 'Front', face.name,
        available.map(other => `${other.id === 'back' ? 'Flipped side' : 'Front'}: ${other.name}`).join('; '),
        face.data.acquisition ?? '', face.printedIds.join('; '), notes, card.id]);
    }
  }
  return rows.sort((a, b) => (cycleOrder.get(b[1]) ?? -1) - (cycleOrder.get(a[1]) ?? -1)
    || a[0].localeCompare(b[0], 'en') || a[4].localeCompare(b[4], 'en') || a[10].localeCompare(b[10], 'en'));
}

export function toCsv(matrix) {
  return '\uFEFF' + matrix.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}

export async function loadReport() {
  const catalogue = JSON.parse(await readFile(resolve(root, 'data/generated/catalogue.json'), 'utf8'));
  const available = new Set();
  for (const card of catalogue.cards) {
    for (const face of card.faces) {
      if (face.kind !== 'gear' || !face.artwork) continue;
      try { await access(resolve(root, face.artwork.image)); available.add(`${card.id}/${face.id}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const skipped = new Map();
  for (const filename of (await readdir(resolve(root, 'data/reference'))).filter(name => /^gear-art-.*\.json$/.test(name))) {
    const config = JSON.parse(await readFile(resolve(root, 'data/reference', filename), 'utf8'));
    for (const card of config.skippedCards ?? []) {
      if (card.definitionId && /no illustration/.test(card.reason ?? '')) skipped.set(`${card.definitionId}/${card.faceId}`, card.reason);
    }
  }
  const rows = missingGearRows(catalogue, available, skipped);
  return { headers, rows, availableCount: available.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = resolve(root, process.argv[2] ?? 'docs/reports/missing-gear-art.csv');
  const report = await loadReport();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, toCsv([headers, ...report.rows]), 'utf8');
  console.log(`${report.rows.length} missing Gear sides across ${new Set(report.rows.map(row => row[10])).size} definitions; ${report.availableCount} sides have images.\n${output}`);
}
