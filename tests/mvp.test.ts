import { beforeAll, describe, expect, it } from 'vitest';
import type { Content } from '../src/content/schema.ts';
import { mvpInventory, validateMvpInventory } from '../src/content/mvp.ts';
import { generateBirth } from '../src/engine/birth.ts';
import { availableChoices } from '../src/engine/events.ts';
import { advanceLife, startLife } from '../src/engine/game.ts';
import { loadGame, SAVE_KEY, validateSavedState } from '../src/engine/save.ts';
import { GameSession } from '../src/engine/session.ts';
import { gameplayContent, mvpContent } from './fixtures.ts';

const entityIds = [
  'fantasy_adventurer','fantasy_sword','fantasy_slime','fantasy_dragon','fantasy_dungeon',
  'zombie_survivor','zombie_zombie','zombie_virus','zombie_shelter_ai','zombie_can',
  'cyberpunk_hacker','cyberpunk_android','cyberpunk_vending','cyberpunk_server_ai','cyberpunk_memory_chip',
  'space_alien','space_ship','space_asteroid','space_blackhole','space_parasite',
  'hunter_rookie','hunter_boss','hunter_mana_stone','hunter_mascot','hunter_admin',
  'reality_human','reality_cat','reality_tree','reality_stone','reality_fridge',
];
let content: Content;
const seeds = new Map<string, number>();
beforeAll(async () => {
  content = await mvpContent();
  for (let seed = 0; seed < 4096 && seeds.size < entityIds.length; seed++) {
    const birth = generateBirth(content, seed);
    if (!seeds.has(birth.entityId)) seeds.set(birth.entityId, seed);
  }
});

describe('MVP 실제 콘텐츠 통합', () => {
  it('명세의 30개 유형과 세계별 공통·전용·범용·엔딩 수량을 충족한다', () => {
    expect(Object.keys(content.entities).sort()).toEqual([...entityIds].sort());
    const report = validateMvpInventory(content);
    expect(report.normalEvents).toBe(185);
    expect(report.fallbackEvents).toBe(6);
    expect(report.universal).toBe(18);
    expect(report.worlds.every(world => world.entities.every(entity => entity.events >= 3))).toBe(true);
  });

  it('안전 대체 사건으로 일반 콘텐츠 수량 부족을 숨기지 않는다', () => {
    const broken = structuredClone(content);
    for (const id of Object.keys(broken.events).filter(id => id.startsWith('universal_')).slice(0, 6)) delete broken.events[id];
    expect(mvpInventory(broken).normalEvents).toBe(179);
    expect(() => validateMvpInventory(broken)).toThrow('일반 사건 180개');
  });

  it.each(entityIds)('%s: 원본 전체 추첨으로 출생하고 모든 선택 시점에 저장·복원하며 완주한다', entityId => {
    const seed = seeds.get(entityId);
    expect(seed).toBeDefined();
    const values = new Map<string,string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const session = new GameSession(content, () => storage);
    const birth = session.roll(seed!);
    expect(birth.entityId).toBe(entityId);
    let state = session.start();
    for (let step = 0; step <= 12; step++) {
      const recovered = new GameSession(content, () => storage);
      expect(recovered.resume().status).toBe('loaded');
      expect(recovered.state).toEqual(state);
      expect(Object.values(state.stats).every(value => value >= 0 && value <= 100)).toBe(true);
      expect(state.birthEntityId).toBe(entityId);
      if (step === 12) break;
      const event = content.events[state.currentEventId!]!;
      expect(event.isFallback).not.toBe(true);
      const choices = availableChoices(event, state);
      expect(choices.length).toBeGreaterThanOrEqual(2);
      const choice = choices[(step + seed!) % choices.length]!;
      const restoredNext = recovered.choose(event.id, choice.id, step);
      state = session.choose(event.id, choice.id, step);
      expect(restoredNext).toEqual(state);
    }
    expect(state.status).toBe('ended');
    expect(state.choiceHistory).toHaveLength(12);
    expect(content.endings[state.endingId!]!.worldIds).toContain(state.worldId);
  });

  it('새 콘텐츠는 이전 저장을 임의로 재해석하지 않고 새 인생 안내를 제공한다', async () => {
    const old = await gameplayContent();
    const raw = JSON.stringify({ saveVersion: 1, state: startLife(old, generateBirth(old, 42)) });
    const values = new Map([[SAVE_KEY, raw]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key,value); } };
    expect(loadGame(content, () => storage).status).toBe('incompatible');
    expect(values.get(SAVE_KEY)).toBe(raw);
    const session = new GameSession(content, () => storage); session.resume(); session.roll(0); session.start();
    expect(loadGame(content, () => storage).status).toBe('loaded');
    expect(values.get(SAVE_KEY)).not.toBe(raw);
  });

  it('실제 변신 경로에서 출생·기록을 보존하고 바뀐 존재로 복원한다', () => {
    const required = new Set(['fantasy_slime>fantasy_dragon', 'fantasy_sword>fantasy_adventurer', 'zombie_zombie>zombie_survivor', 'cyberpunk_vending>cyberpunk_server_ai', 'hunter_boss>hunter_rookie']);
    for (let seed = 0; seed < 4096 && required.size; seed++) {
      const birth = generateBirth(content, seed);
      if (![...required].some(route => route.startsWith(`${birth.entityId}>`))) continue;
      let state = startLife(content, birth);
      while (state.status === 'playing') {
        const event = content.events[state.currentEventId!]!;
        const previous = state;
        state = advanceLife(content, state, event.id, availableChoices(event, state)[0]!.id).state;
        if (state.entityId !== previous.entityId) {
          expect(state.birthEntityId).toBe(birth.entityId);
          expect(state.birthStory).toBe(birth.birthStory);
          expect(state.choiceHistory.slice(0, -1)).toEqual(previous.choiceHistory);
          expect(validateSavedState(content, state)).toEqual(state);
          required.delete(`${previous.entityId}>${state.entityId}`);
        }
      }
    }
    expect([...required]).toEqual([]);
  }, 20000);
});
