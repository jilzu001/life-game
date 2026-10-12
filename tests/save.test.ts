import { beforeAll, describe, expect, it } from 'vitest';
import type { Content } from '../src/content/schema.ts';
import { generateBirth } from '../src/engine/birth.ts';
import { availableChoices } from '../src/engine/events.ts';
import { advanceLife, startLife } from '../src/engine/game.ts';
import type { GameState } from '../src/engine/game-state.ts';
import { loadGame, saveGame, SAVE_KEY, validateSavedState, type StoragePort } from '../src/engine/save.ts';
import { GameSession } from '../src/engine/session.ts';
import { gameplayContent } from './fixtures.ts';

let content: Content;
beforeAll(async () => { content = await gameplayContent(); });
class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  writes = 0;
  failWrites = false;
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('저장 한도 초과');
    this.values.set(key, value); this.writes++;
  }
}
function next(state: GameState): GameState {
  const event = content.events[state.currentEventId!]!;
  return advanceLife(content, state, event.id, availableChoices(event, state)[0]!.id).state;
}

describe('저장·복원과 자동 저장 세션', () => {
  it('출생 확정과 12개 선택마다 저장하며 단계·변신·엔딩을 복원한다', () => {
    const storage = new MemoryStorage();
    const session = new GameSession(content, () => storage);
    expect(session.resume().status).toBe('empty');
    session.roll(42); session.roll(42); expect(storage.writes).toBe(0);
    let state = session.start(); expect(storage.writes).toBe(1);
    const originalBirthEntity = state.birthEntityId;
    for (let count = 0; count <= 12; count++) {
      const recovered = new GameSession(content, () => storage);
      const result = recovered.resume(); expect(result.status).toBe('loaded');
      expect(recovered.state).toEqual(state);
      expect(validateSavedState(content, state)).toEqual(state);
      if (count === 12) break;
      const event = content.events[state.currentEventId!]!;
      const choice = availableChoices(event, state)[0]!;
      const fromRecovery = recovered.choose(event.id, choice.id, count);
      state = session.choose(event.id, choice.id, count);
      expect(fromRecovery).toEqual(state);
    }
    expect(state.status).toBe('ended'); expect(state.stage).toBe('conclusion');
    expect(state.entityId).toBe('fantasy_adventurer'); expect(originalBirthEntity).toBe('fantasy_sword');
    expect(state.birthEntityId).toBe('fantasy_sword');
    expect(state.choiceHistory.some(entry => entry.entityId === 'fantasy_sword')).toBe(true);
    expect(state.choiceHistory.some(entry => entry.entityId === 'fantasy_adventurer')).toBe(true);
    expect(state.hiddenFateRevealed).toBe(true);
    expect(storage.writes).toBe(25); // 확정 1회 + 원본/복원 세션 각각 12회.
  });
  it('진행 중 재추첨, 중복 입력, 반환 객체를 통한 상태 변경을 차단한다', () => {
    const storage = new MemoryStorage(); const session = new GameSession(content, () => storage);
    session.roll(42); const state = session.start();
    expect(() => session.roll(1)).toThrow('출생을 바꿀 수 없습니다');
    state.stats.survival = 0; expect(session.state!.stats.survival).not.toBe(0);
    session.choose('fantasy_first_voice', 'trust', 0);
    expect(() => session.choose('fantasy_first_voice', 'trust', 0)).toThrow('이미 처리');
    const recovered = new GameSession(content, () => storage);
    const result = recovered.resume();
    if (result.status !== 'loaded') throw new Error('복원 실패');
    result.state.stats.survival = 0; expect(recovered.state!.stats.survival).not.toBe(0);
  });
  it('반복 안전 사건에서도 이전 화면의 중복 선택은 재처리하지 않는다', () => {
    const sparse = { ...content, events: { fantasy_quiet: content.events.fantasy_quiet! } };
    const session = new GameSession(sparse, () => new MemoryStorage());
    session.roll(42); session.start(); session.choose('fantasy_quiet', 'rest', 0);
    expect(() => session.choose('fantasy_quiet', 'rest', 0)).toThrow('이미 처리');
    expect(session.state!.completedEventCount).toBe(1);
  });
  it('저장 실패 시 현재 인생과 마지막 정상 저장을 유지한다', () => {
    const storage = new MemoryStorage(); const session = new GameSession(content, () => storage);
    session.roll(42); session.start(); const previous = storage.getItem(SAVE_KEY);
    storage.failWrites = true;
    const state = session.choose('fantasy_first_voice', 'trust', 0);
    expect(state.completedEventCount).toBe(1); expect(session.message).toContain('실패');
    expect(storage.getItem(SAVE_KEY)).toBe(previous);
    expect(loadGame(content, () => storage)).toMatchObject({ status: 'loaded', state: { completedEventCount: 0 } });
  });
  it('저장 공간 접근 차단을 예외 대신 안내로 반환한다', () => {
    const blocked = () => { throw new Error('SecurityError'); };
    expect(loadGame(content, blocked).status).toBe('unavailable');
    const state = startLife(content, generateBirth(content, 42));
    expect(saveGame(content, state, blocked).ok).toBe(false);
  });
  it.each(['{broken', '', '{}', 'null', 'x'.repeat(250001)])('손상된 저장을 안전하게 처리한다 %#', raw => {
    const storage = new MemoryStorage(); storage.setItem(SAVE_KEY, raw);
    expect(loadGame(content, () => storage).status).toBe('invalid');
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });
  it('콘텐츠·저장 버전 변경은 새 인생 안내를 반환한다', () => {
    const storage = new MemoryStorage();
    const state = startLife(content, generateBirth(content, 42));
    storage.setItem(SAVE_KEY, JSON.stringify({ saveVersion: 99, state }));
    expect(loadGame(content, () => storage).status).toBe('incompatible');
    storage.setItem(SAVE_KEY, JSON.stringify({ saveVersion: 1, state: { ...state, contentVersion: 'old' } }));
    expect(loadGame(content, () => storage).status).toBe('incompatible');
  });
  it.each([
    ['능력치', (state: GameState) => { state.stats.survival = state.stats.survival === 0 ? 1 : 0; }],
    ['난수', (state: GameState) => { state.rng.state ^= 1; }],
    ['존재', (state: GameState) => { state.entityId = 'missing'; }],
    ['단계', (state: GameState) => { state.stage = 'climax'; }],
    ['선택 기록', (state: GameState) => { state.choiceHistory[0]!.choiceId = 'missing'; }],
    ['운명 공개', (state: GameState) => { state.hiddenFateRevealed = true; }],
    ['방문 목록', (state: GameState) => { state.visitedEventIds = []; }],
  ] as const)('%s 불일치를 전체 재현 검증으로 감지한다', (_label, mutate) => {
    const storage = new MemoryStorage(); const state = next(startLife(content, generateBirth(content, 42)));
    mutate(state); storage.setItem(SAVE_KEY, JSON.stringify({ saveVersion: 1, state }));
    expect(loadGame(content, () => storage).status).toBe('invalid');
  });
  it('미확정 출생은 저장하지 않으며 유효한 재시작에서만 이전 저장을 교체한다', () => {
    const storage = new MemoryStorage(); storage.setItem(SAVE_KEY, 'bad');
    const session = new GameSession(content, () => storage); expect(session.resume().status).toBe('invalid');
    const birth = session.roll(42); expect(storage.getItem(SAVE_KEY)).toBe('bad');
    expect(saveGame(content, birth, () => storage).ok).toBe(false);
    session.start(); expect(loadGame(content, () => storage).status).toBe('loaded');
  });
});
