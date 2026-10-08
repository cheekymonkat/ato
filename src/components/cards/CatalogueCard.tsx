import type { CardDefinition, CardFace } from '../../domain/cards';
import { ClueCard } from './ClueCard';
import { ConditionCard } from './ConditionCard';
import { ExplorationCard } from './ExplorationCard';
import { KratosCard, MoirosCard } from './KratosCard';
import type { TextActions } from './RichParagraph';
import { StoryDoomCard } from './StoryDoomCard';
import { GodformCard, NymphCard } from './SummoningCard';
import { TerrainCard } from './TerrainCard';
import { TraumaCard } from './TraumaCard';

const families = new Set(['Clue', 'Condition', 'Doom', 'Exploration', 'Godform', 'Kratos', 'Moiros', 'Nymph', 'Story', 'Terrain', 'Trauma']);
export function supportsCatalogueCard(face: CardFace) { return families.has(face.family); }

/** Shared reference layouts for decks, linked cards and standalone inspection. */
export function CatalogueCard({ card, face, width, ...actions }: TextActions & { card: CardDefinition; face: CardFace; width: number }) {
  const props = { face, width, ...actions };
  switch (face.family) {
    case 'Clue': return <ClueCard {...props} />;
    case 'Condition': return <ConditionCard {...props} />;
    case 'Doom': case 'Story': return <StoryDoomCard card={card} {...props} />;
    case 'Exploration': return <ExplorationCard {...props} />;
    case 'Godform': return <GodformCard {...props} />;
    case 'Kratos': return <KratosCard {...props} />;
    case 'Moiros': return <MoirosCard {...props} />;
    case 'Nymph': return <NymphCard {...props} />;
    case 'Terrain': return <TerrainCard {...props} />;
    case 'Trauma': return <TraumaCard {...props} />;
    default: return null;
  }
}
