import type { Content, Ending } from '../content/schema.ts';
import { matchesCondition } from './conditions.ts';
import type { GameState } from './game-state.ts';

export function selectEnding(content: Content, state: GameState): Ending {
  const endings = Object.values(content.endings)
    .filter(ending => ending.worldIds.includes(state.worldId) && matchesCondition(ending.conditions, state))
    .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!endings[0]) throw new Error(`세계관 ${state.worldId}에 도달 가능한 엔딩이 없습니다.`);
  return endings[0];
}
