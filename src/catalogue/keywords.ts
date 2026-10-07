import standard from '../../data/reference/keywords.json';
import titan from '../../data/reference/titanAbilityData.json';
import primordial from '../../data/reference/primordialAbilityData.json';
import overrides from '../../data/reference/keyword-overrides.json';
import traitOverrides from '../../data/reference/primordial-trait-overrides.json';
import { createKeywordRepository } from '../domain/keywords.ts';

export const keywordRepository = createKeywordRepository({ ...titan, ...standard, ...primordial, ...overrides });
export const primordialTraitOverrides = traitOverrides;
