import type { Content } from './schema.ts';
import { generateBirth } from '../engine/birth.ts';
import { availableChoices, MAX_EVENTS } from '../engine/events.ts';
import { advanceLife, startLife } from '../engine/game.ts';
import { SeededRandom } from '../engine/randomness.ts';

export const SIMULATION_SEEDS = Array.from({ length: 64 }, (_, index) => index);
export const SIMULATION_STRATEGIES = ['first', 'last', 'cycle', 'random'] as const;

/** 유한한 고정 시드 집합의 회귀·도달성 검사다. 임의 조건 전체에 대한 수학적 증명은 아니다. */
export function simulateContent(content: Content, seeds: readonly number[] = SIMULATION_SEEDS) {
  const observed = new Set<string>();
  const errors: string[] = [];
  let runs = 0;
  let fallbackVisits = 0;
  for (const seed of seeds) for (const strategy of SIMULATION_STRATEGIES) {
    try {
      const birth = generateBirth(content, seed);
      observed.add(`entity:${birth.entityId}`);
      let state = startLife(content, birth);
      const decisions = new SeededRandom((seed ^ 0x9e3779b9) >>> 0);
      for (let step = 0; step < MAX_EVENTS; step++) {
        if (state.status !== 'playing' || !state.currentEventId) throw new Error('12개 사건 전에 진행이 중단됐습니다.');
        const event = content.events[state.currentEventId]!;
        observed.add(`event:${event.id}`);
        if (event.isFallback) fallbackVisits++;
        const choices = availableChoices(event, state);
        const index = strategy === 'first' ? 0 : strategy === 'last' ? choices.length - 1
          : strategy === 'cycle' ? (seed + step) % choices.length : Math.floor(decisions.next() * choices.length);
        const choice = choices[index];
        if (!choice) throw new Error('선택 가능한 선택지가 없습니다.');
        observed.add(`choice:${event.id}/${choice.id}`);
        const transition = advanceLife(content, state, event.id, choice.id);
        if (transition.route && !['draw', 'fallback'].includes(transition.route.via)) {
          const owner = transition.route.via.startsWith('choice:') ? `${event.id}/${choice.id}` : event.id;
          observed.add(`route:${owner}/${transition.route.via}`);
        }
        state = transition.state;
      }
      if (state.status !== 'ended' || !state.endingId || state.completedEventCount !== MAX_EVENTS) throw new Error('최종 엔딩에 도달하지 못했습니다.');
      observed.add(`ending:${state.endingId}`);
      runs++;
    } catch (error) { errors.push(`시드 ${seed}, 전략 ${strategy}: ${(error as Error).message}`); }
  }
  const required = Object.keys(content.entities).map(id => `entity:${id}`);
  required.push(...Object.keys(content.endings).map(id => `ending:${id}`));
  for (const event of Object.values(content.events)) {
    if (event.isFallback) continue;
    required.push(`event:${event.id}`);
    if (event.nextEventId) required.push(`route:${event.id}/event:direct`);
    event.branches.forEach((_branch, index) => required.push(`route:${event.id}/event:branch:${index}`));
    for (const choice of event.choices) {
      required.push(`choice:${event.id}/${choice.id}`);
      if (choice.nextEventId) required.push(`route:${event.id}/${choice.id}/choice:direct`);
      choice.branches.forEach((_branch, index) => required.push(`route:${event.id}/${choice.id}/choice:branch:${index}`));
    }
  }
  return { runs, fallbackVisits, observed: [...observed].sort(), missing: required.filter(key => !observed.has(key)), errors };
}
