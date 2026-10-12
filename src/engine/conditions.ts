import type { Condition } from '../content/schema.ts';
import { matchesBirthCondition } from './birth.ts';
import type { GameState } from './game-state.ts';

export function matchesCondition(condition: Condition | undefined, state: GameState): boolean {
  if (!condition) return true;
  if ('all' in condition) return condition.all.every(child => matchesCondition(child, state));
  if ('any' in condition) return condition.any.some(child => matchesCondition(child, state));
  if (condition.type === 'event' || condition.type === 'choice') {
    const present = state.choiceHistory.some(entry => entry.eventId === condition.eventId
      && (condition.type !== 'choice' || entry.choiceId === condition.choiceId));
    return condition.operator === 'equals' ? present === condition.value : present !== condition.value;
  }
  return matchesBirthCondition(condition, state);
}
