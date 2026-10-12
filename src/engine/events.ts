import type { Choice, Content, GameEvent, Stage } from '../content/schema.ts';
import { matchesCondition } from './conditions.ts';
import type { GameState } from './game-state.ts';
import { SeededRandom } from './randomness.ts';

export const MAX_EVENTS = 12;
export function stageAt(completed: number): Stage {
  if (!Number.isInteger(completed) || completed < 0 || completed > MAX_EVENTS) throw new Error('잘못된 사건 진행 횟수입니다.');
  if (completed === MAX_EVENTS) return 'conclusion';
  if (completed < 2) return 'awakening';
  if (completed < 4) return 'growth';
  if (completed < 6) return 'crisis';
  if (completed < 8) return 'transition';
  return 'climax';
}

export function availableChoices(event: GameEvent, state: GameState): Choice[] {
  return event.choices.filter(choice => matchesCondition(choice.conditions, state));
}

export function isEligible(event: GameEvent, state: GameState): boolean {
  if (event.worldIds.length && !event.worldIds.includes(state.worldId)) return false;
  if ((event.entityIds.length || event.entityTags.length)
    && !event.entityIds.includes(state.entityId) && !event.entityTags.some(tag => state.tags.includes(tag))) return false;
  if (event.stage !== 'any' && event.stage !== state.stage) return false;
  const visits = state.visitedEventIds.filter(id => id === event.id).length;
  if (visits >= (event.isFallback ? MAX_EVENTS : 1)) return false;
  return matchesCondition(event.conditions, state) && availableChoices(event, state).length > 0;
}

export function eventWeight(event: GameEvent, state: GameState): number {
  return event.weight * (1 + (event.chaosWeight ?? 0) * state.stats.chaos / 100);
}

export function drawEvent(content: Content, state: GameState, random: SeededRandom): GameEvent {
  const events = Object.values(content.events).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const candidates = events.filter(event => !event.isFallback && isEligible(event, state));
  if (candidates.length) return random.weighted(candidates.map(event => ({ event, weight: eventWeight(event, state) }))).event;
  const fallback = events.find(event => event.isFallback && isEligible(event, state));
  if (!fallback) throw new Error(`세계관 ${state.worldId}에 진행 가능한 안전 사건이 없습니다.`);
  return fallback;
}
