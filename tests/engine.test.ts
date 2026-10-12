import { beforeAll, describe, expect, it } from 'vitest';
import type { Content, GameEvent } from '../src/content/schema.ts';
import { simulateContent } from '../src/content/simulation.ts';
import { generateBirth } from '../src/engine/birth.ts';
import { nextEvent } from '../src/engine/branching.ts';
import { matchesCondition } from '../src/engine/conditions.ts';
import { applyEffects } from '../src/engine/effects.ts';
import { selectEnding } from '../src/engine/endings.ts';
import { availableChoices, drawEvent, eventWeight, isEligible, stageAt } from '../src/engine/events.ts';
import { advanceLife, startLife } from '../src/engine/game.ts';
import { SeededRandom } from '../src/engine/randomness.ts';
import { validateReferences } from '../src/content/validator.ts';
import { gameplayContent, sampleEvent } from './fixtures.ts';

let content: Content;
beforeAll(async () => { content = await gameplayContent(); });

describe('선언형 사건 실행', () => {
  it('현재 사건은 완료 이력에 포함하지 않고 선택 이후에만 참조한다', () => {
    const state = startLife(content, generateBirth(content, 42));
    const condition = { type: 'event', eventId: 'fantasy_first_voice', operator: 'equals', value: true } as const;
    expect(state.visitedEventIds).toContain('fantasy_first_voice');
    expect(matchesCondition(condition, state)).toBe(false);
    const next = advanceLife(content, state, 'fantasy_first_voice', 'trust').state;
    expect(matchesCondition(condition, next)).toBe(true);
    expect(matchesCondition({ all: [condition, { any: [
      { type: 'choice', eventId: 'fantasy_first_voice', choiceId: 'trust', operator: 'equals', value: true },
      { type: 'choice', eventId: 'fantasy_first_voice', choiceId: 'threaten', operator: 'equals', value: true },
    ] }] }, next)).toBe(true);
    expect(matchesCondition({ type: 'choice', eventId: 'fantasy_first_voice', choiceId: 'threaten', operator: 'notEquals', value: true }, next)).toBe(true);
  });
  it('모든 효과를 순서대로 처리하고 변신 전 상태와 기록을 보존한다', () => {
    const state = startLife(content, generateBirth(content, 42));
    const original = structuredClone(state);
    const next = applyEffects(content, state, [
      { op: 'setStat', key: 'survival', value: 95 }, { op: 'addStat', key: 'survival', value: 50 },
      { op: 'setStat', key: 'freedom', value: 5 }, { op: 'addStat', key: 'freedom', value: -50 },
      { op: 'addTag', key: 'temporary' }, { op: 'removeTag', key: 'temporary' },
      { op: 'addItem', key: 'token' }, { op: 'addItem', key: 'token' },
      { op: 'addItem', key: 'temporary' }, { op: 'removeItem', key: 'temporary' },
      { op: 'setFlag', key: 'remembered', value: true }, { op: 'setFlag', key: 'can_speak', value: false },
      { op: 'transformEntity', entityId: 'fantasy_adventurer' },
    ]);
    expect(next.stats.survival).toBe(100); expect(next.stats.freedom).toBe(0);
    expect(next.flags.remembered).toBe(true); expect(next.flags.can_speak).toBe(false);
    expect(next.items.filter(id => id === 'token')).toHaveLength(1);
    expect(next.tags).not.toContain('temporary'); expect(next.items).not.toContain('temporary');
    expect(next.entityId).toBe('fantasy_adventurer'); expect(next.birthEntityId).toBe(original.birthEntityId);
    expect(next.tags).toContain('human'); expect(next.tags).toContain('weapon');
    expect(next.birthStory).toBe(original.birthStory); expect(next.visitedEventIds).toEqual(original.visitedEventIds);
    expect(state).toEqual(original);
    expect(() => applyEffects(content, state, [{ op: 'addStat', key: 'survival', value: -10 }, { op: 'transformEntity', entityId: 'missing' }])).toThrow();
    expect(state).toEqual(original);
  });
  it('시작 후 출생 재확정과 잠긴 선택, 오래된 사건 입력을 거부한다', () => {
    const birth = generateBirth(content, 42);
    const state = startLife(content, birth);
    expect(() => startLife(content, state)).toThrow();
    expect(birth.status).toBe('birth');
    expect(() => advanceLife(content, state, 'fantasy_knight', 'pledge')).toThrow('지나간 사건');
    expect(() => advanceLife(content, state, state.currentEventId!, 'missing')).toThrow('선택지');
    const mute = structuredClone(state); mute.flags.can_speak = false;
    expect(() => advanceLife(content, mute, mute.currentEventId!, 'speak')).toThrow('선택지');
  });
  it('2·4·6·8·12개 완료 경계에서 단계가 바뀐다', () => {
    expect(Array.from({ length: 13 }, (_, count) => stageAt(count))).toEqual([
      'awakening', 'awakening', 'growth', 'growth', 'crisis', 'crisis', 'transition', 'transition', 'climax', 'climax', 'climax', 'climax', 'conclusion',
    ]);
    expect(() => stageAt(13)).toThrow();
  });
});

describe('분기 우선순위와 사건 후보', () => {
  function fixture() {
    const state = generateBirth(content, 42); state.stage = 'awakening';
    const make = (id: string): GameEvent => ({ ...sampleEvent(), id, entityIds: [] });
    const a = make('target_a'), b = make('target_b'), c = make('target_c');
    const isolated: Content = { ...content, events: { target_a: a, target_b: b, target_c: c, fantasy_quiet: content.events.fantasy_quiet! } };
    const source = make('source');
    const choice = source.choices[0]!;
    source.nextEventId = b.id; choice.nextEventId = a.id;
    choice.branches = [{ conditions: { type: 'world', operator: 'equals', value: 'fantasy' }, nextEventId: c.id }];
    return { state, isolated, source, choice, a, b, c };
  }
  it('직접 지정이 조건 분기보다 먼저이며 이미 방문한 목적지는 건너뛴다', () => {
    const { state, isolated, source, choice } = fixture();
    const random = new SeededRandom(0);
    expect(nextEvent(isolated, state, random, source, choice)).toMatchObject({ event: { id: 'target_a' }, via: 'choice:direct' });
    state.visitedEventIds.push('target_a');
    expect(nextEvent(isolated, state, random, source, choice)).toMatchObject({ event: { id: 'target_b' }, via: 'event:direct' });
    state.visitedEventIds.push('target_b');
    expect(nextEvent(isolated, state, random, source, choice)).toMatchObject({ event: { id: 'target_c' }, via: 'choice:branch:0' });
    state.visitedEventIds.push('target_c');
    expect(nextEvent(isolated, state, random, source, choice)).toMatchObject({ event: { id: 'fantasy_quiet' }, via: 'fallback' });
  });
  it('조건부 분기는 효과와 방금 선택한 이력을 반영한다', () => {
    const state = startLife(content, generateBirth(content, 42));
    const knight = advanceLife(content, state, 'fantasy_first_voice', 'trust').state;
    const next = advanceLife(content, knight, 'fantasy_knight', 'pledge');
    expect(next.state.flags.oath).toBe(true);
    expect(next.route?.via).toBe('event:branch:0');
    expect(next.state.currentEventId).toBe('fantasy_court');
  });
  it('세계·존재 또는 태그·단계·조건·선택 가능 여부를 모두 검사한다', () => {
    const { state, a } = fixture();
    expect(isEligible(a, state)).toBe(true);
    a.worldIds = ['other']; expect(isEligible(a, state)).toBe(false); a.worldIds = ['fantasy'];
    a.entityIds = ['fantasy_adventurer']; expect(isEligible(a, state)).toBe(false);
    a.entityTags = ['weapon']; expect(isEligible(a, state)).toBe(true);
    a.stage = 'crisis'; expect(isEligible(a, state)).toBe(false); a.stage = 'any';
    a.conditions = { type: 'flag', key: 'missing', operator: 'equals', value: true };
    expect(isEligible(a, state)).toBe(false); delete a.conditions;
    for (const choice of a.choices) choice.conditions = { type: 'flag', key: 'missing', operator: 'equals', value: true };
    expect(isEligible(a, state)).toBe(false);
  });
  it('혼돈도는 지정 사건의 빈도를 높이고 효과 자체를 증폭하지 않는다', () => {
    const { state, isolated, a, b } = fixture();
    a.chaosWeight = 4;
    isolated.events = { target_a: a, target_b: b };
    const low = structuredClone(state), high = structuredClone(state); low.stats.chaos = 0; high.stats.chaos = 100;
    expect(eventWeight(a, low)).toBe(10); expect(eventWeight(a, high)).toBe(50);
    let lowCount = 0, highCount = 0;
    const lowRandom = new SeededRandom(1), highRandom = new SeededRandom(1);
    for (let i = 0; i < 1000; i++) {
      if (drawEvent(isolated, low, lowRandom).id === a.id) lowCount++;
      if (drawEvent(isolated, high, highRandom).id === a.id) highCount++;
    }
    expect(highCount).toBeGreaterThan(lowCount + 200);
    const effect = [{ op: 'addStat', key: 'survival', value: -20 }] as const;
    expect(applyEffects(content, low, effect).stats.survival).toBe(applyEffects(content, high, effect).stats.survival);
  });
  it('없는 분기는 실행 시에도 오류이며 자기 순환은 재방문하지 않는다', () => {
    const { state, isolated, source, choice } = fixture();
    choice.nextEventId = 'missing';
    expect(() => nextEvent(isolated, state, new SeededRandom(0), source, choice)).toThrow('목적지');
    const loop = structuredClone(content);
    loop.events.fantasy_first_voice!.choices[0]!.nextEventId = 'fantasy_first_voice';
    const started = startLife(loop, generateBirth(loop, 42));
    const next = advanceLife(loop, started, 'fantasy_first_voice', 'trust').state;
    expect(next.currentEventId).not.toBe('fantasy_first_voice');
  });
});

describe('완주·엔딩·도달성', () => {
  it('두 출생 유형과 모든 샘플 분기·선택·엔딩에 256회 시뮬레이션으로 도달한다', () => {
    const result = simulateContent(content);
    expect(result.errors).toEqual([]); expect(result.missing).toEqual([]);
    expect(result.runs).toBe(256); expect(result.fallbackVisits).toBe(0);
  });
  it('일반 사건이 없어도 안전 사건으로 정확히 12개 후 엔딩에 도달한다', () => {
    const sparse = { ...content, events: { fantasy_quiet: content.events.fantasy_quiet! } };
    let state = startLife(sparse, generateBirth(sparse, 42));
    for (let count = 0; count < 12; count++) state = advanceLife(sparse, state, state.currentEventId!, count % 2 ? 'reflect' : 'rest').state;
    expect(state.status).toBe('ended'); expect(state.completedEventCount).toBe(12); expect(state.endingId).toBeTruthy();
    expect(state.visitedEventIds).toHaveLength(12);
    expect(() => advanceLife(sparse, state, 'fantasy_quiet', 'rest')).toThrow();
  });
  it('엔딩 동률은 ID 순서이며 어떤 상태든 기본 엔딩이 있다', () => {
    const state = generateBirth(content, 42);
    expect(selectEnding(content, state).id).toBe('fantasy_survivor');
    const baseline = content.endings.fantasy_survivor!;
    const tied = { ...content, endings: { z: { ...baseline, id: 'z', priority: 99 }, a: { ...baseline, id: 'a', priority: 99 } } };
    expect(selectEnding(tied, state).id).toBe('a');
    state.stats.influence = 100;
    expect(selectEnding(content, state).id).toBe('fantasy_survivor');
    state.flags.oath = true; expect(selectEnding(content, state).id).toBe('fantasy_legend');
  });
  it('불가능한 조건 분기를 시뮬레이션 미도달로 감지한다', () => {
    const broken = structuredClone(content);
    broken.events.fantasy_knight!.branches[0]!.conditions = { all: [
      { type: 'stat', key: 'survival', operator: 'gte', value: 90 },
      { type: 'stat', key: 'survival', operator: 'lte', value: 10 },
    ] };
    expect(simulateContent(broken, [0, 1, 42]).missing).toContain('route:fantasy_knight/event:branch:0');
  });
  it('진행 불가능한 안전 사건과 기본 엔딩 누락을 콘텐츠 검사에서 차단한다', () => {
    const broken = structuredClone(content);
    broken.events.fantasy_quiet!.conditions = { type: 'flag', key: 'locked', operator: 'equals', value: true };
    expect(() => validateReferences(broken)).toThrow('안전 사건');
    const missing = structuredClone(content); delete missing.endings.fantasy_survivor;
    expect(() => validateReferences(missing)).toThrow('기본 엔딩');
  });
  it('같은 시드·선택은 엔딩까지 같은 상태를 만든다', () => {
    function play() {
      let state = startLife(content, generateBirth(content, 42));
      while (state.status === 'playing') {
        const event = content.events[state.currentEventId!]!;
        state = advanceLife(content, state, event.id, availableChoices(event, state)[0]!.id).state;
      }
      return state;
    }
    expect(play()).toEqual(play());
  });
});
