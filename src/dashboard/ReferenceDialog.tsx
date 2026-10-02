import type { CardFace } from '../domain/cards';
import { Sheet } from '../components/Sheet';
import { PatternTable } from '../components/PatternTable';

export function ReferenceDialog({ kind, titan, onClose }: { kind: 'Trauma' | 'Kratos'; titan: CardFace; onClose: () => void }) {
  const table = titan.kind === 'titan' ? kind === 'Trauma' ? titan.data.traumaTable : titan.data.kratosTable : [];
  return <Sheet visible title={titan.name} subtitle={`${kind} reference · ${titan.cycle}`} onClose={onClose}>
    <PatternTable kind={kind} table={table} />
  </Sheet>;
}
