import type { Choice, Content, GameEvent } from '../content/schema.ts';
import { matchesCondition } from './conditions.ts';
import { drawEvent, isEligible } from './events.ts';
import type { GameState } from './game-state.ts';
import type { SeededRandom } from './randomness.ts';

export interface EventRoute { event: GameEvent; via: string }

export function nextEvent(content: Content, state: GameState, random: SeededRandom, source?: GameEvent, choice?: Choice): EventRoute {
  function target(id: string): GameEvent | undefined {
    const event = Object.hasOwn(content.events, id) ? content.events[id] : undefined;
    if (!event) throw new Error(`분기 목적지가 없습니다: ${id}`);
    return isEligible(event, state) ? event : undefined;
  }
  // 선택지 직접 지정 → 사건 직접 지정 → 선택지 조건 분기 → 사건 조건 분기.
  for (const [owner, id] of [['choice', choice?.nextEventId], ['event', source?.nextEventId]] as const) {
    if (id) { const event = target(id); if (event) return { event, via: `${owner}:direct` }; }
  }
  for (const [owner, branches] of [['choice', choice?.branches ?? []], ['event', source?.branches ?? []]] as const) {
    for (let index = 0; index < branches.length; index++) {
      const branch = branches[index]!;
      if (!matchesCondition(branch.conditions, state)) continue;
      const event = target(branch.nextEventId);
      if (event) return { event, via: `${owner}:branch:${index}` };
    }
  }
  const event = drawEvent(content, state, random);
  return { event, via: event.isFallback ? 'fallback' : 'draw' };
}
