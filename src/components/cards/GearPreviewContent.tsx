import { useState } from 'react';
import { View } from 'react-native';
import type { CardDefinition } from '../../domain/cards';
import { faceForReference } from '../../domain/card-presentation';
import { useSpoilers } from '../../state/SpoilerProvider';
import { Button } from '../Button';
import { GearCard } from './GearCard';
import { SecretCard } from './SecretCard';
import type { TextActions } from './RichParagraph';

export type GearPreviewProps = TextActions & { card: CardDefinition; referenceId: string; label: string };

export function GearPreviewContent({ card, referenceId, width, onReference, onKeyword }: GearPreviewProps & { width: number }) {
  const spoilers = useSpoilers();
  const [faceId, setFaceId] = useState(() => faceForReference(card, referenceId).id);
  const face = card.faces.find(entry => entry.id === faceId) ?? card.faces[0];
  if (spoilers.hidden(card)) return <SecretCard card={card} onReveal={() => spoilers.reveal(card.id)} />;
  return <View style={{ gap: 8 }}>
    {face.kind === 'gear' && <GearCard face={face} width={width} onReference={onReference} onKeyword={onKeyword} />}
    {card.faces.length > 1 && <Button quiet label="Flip card" onPress={() => setFaceId(face.id === 'front' ? 'back' : 'front')} />}
  </View>;
}
