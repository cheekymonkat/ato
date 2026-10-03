import type { CardReference } from '../domain/party';
import { ReferencePicker } from '../references/ReferencePicker';

export function TitanPicker({ selected, onSelect, onClose }: {
  selected?: CardReference | null; onSelect: (reference: CardReference | null) => void; onClose: () => void;
}) {
  return <ReferencePicker family="Titan" selected={selected} onSelect={onSelect} onClose={onClose} />;
}
