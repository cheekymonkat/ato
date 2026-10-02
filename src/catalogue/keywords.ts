import standard from '../../data/reference/keywords.json';
import titan from '../../data/reference/titanAbilityData.json';
import primordial from '../../data/reference/primordialAbilityData.json';
import { createKeywordRepository } from '../domain/keywords.ts';

export const keywordRepository = createKeywordRepository({ ...titan, ...standard, ...primordial });
