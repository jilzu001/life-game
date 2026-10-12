import type { Content } from '../content/schema.ts';
import { nextEvent, type EventRoute } from './branching.ts';
import { applyEffects } from './effects.ts';
import { selectEnding } from './endings.ts';
import { availableChoices, MAX_EVENTS, stageAt } from './events.ts';
import type { GameState } from './game-state.ts';
import { SeededRandom } from './randomness.ts';

export interface Transition { state: GameState; route: EventRoute | null }

function enter(state: GameState, route: EventRoute, random: SeededRandom): void {
  state.currentEventId = route.event.id;
  state.visitedEventIds.push(route.event.id);
  if (route.event.revealsFate) state.hiddenFateRevealed = true;
  state.rng = random.snapshot();
}

export function startLife(content: Content, birth: GameState): GameState {
  if (birth.status !== 'birth' || birth.completedEventCount !== 0 || birth.currentEventId !== null
    || birth.choiceHistory.length || birth.visitedEventIds.length) throw new Error('새로 생성한 출생만 시작할 수 있습니다.');
  if (birth.contentVersion !== content.manifest.contentVersion) throw new Error('콘텐츠 버전이 다릅니다. 다시 태어나세요.');
  if (!birth.birthLocationId || !birth.traitId || !birth.flawId || !birth.hiddenFateId) throw new Error('출생 생성이 완료되지 않았습니다.');
  const state = structuredClone(birth);
  state.status = 'playing'; state.stage = stageAt(0);
  // 진행을 시작하기 전에 기본 엔딩의 존재도 확인한다.
  if (!Object.values(content.endings).some(ending => ending.isDefault && ending.worldIds.includes(state.worldId) && !ending.conditions)) {
    throw new Error('이 세계관의 기본 엔딩이 없습니다.');
  }
  const random = SeededRandom.restore(state.rng);
  enter(state, nextEvent(content, state, random), random);
  return state;
}

export function advanceLife(content: Content, current: GameState, eventId: string, choiceId: string): Transition {
  if (current.status !== 'playing' || current.completedEventCount >= MAX_EVENTS) throw new Error('진행 중인 인생이 아닙니다.');
  if (current.contentVersion !== content.manifest.contentVersion) throw new Error('콘텐츠 버전이 다릅니다.');
  if (current.currentEventId !== eventId) throw new Error('이미 지나간 사건의 선택입니다.');
  const event = Object.hasOwn(content.events, eventId) ? content.events[eventId] : undefined;
  if (!event) throw new Error('현재 사건을 찾을 수 없습니다.');
  const choice = availableChoices(event, current).find(candidate => candidate.id === choiceId);
  if (!choice) throw new Error('현재 선택할 수 없는 선택지입니다.');
  const state = applyEffects(content, current, choice.effects);
  state.choiceHistory.push({ eventId, choiceId, stage: current.stage, entityId: current.entityId, resultText: choice.resultText });
  state.completedEventCount++;
  state.stage = stageAt(state.completedEventCount);
  if (state.completedEventCount === MAX_EVENTS) {
    state.status = 'ended'; state.currentEventId = null;
    state.endingId = selectEnding(content, state).id;
    return { state, route: null };
  }
  const random = SeededRandom.restore(state.rng);
  const route = nextEvent(content, state, random, event, choice);
  enter(state, route, random);
  return { state, route };
}
