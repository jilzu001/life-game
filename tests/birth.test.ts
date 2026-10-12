import { beforeAll, describe, expect, it } from 'vitest';
import { birthPreview, enumerateBirths, generateBirth, matchesBirthCondition } from '../src/engine/birth.ts';
import { gameStateSchema } from '../src/engine/game-state.ts';
import { SeededRandom } from '../src/engine/randomness.ts';
import type { Content, BirthCondition } from '../src/content/schema.ts';
import { sampleContent } from './fixtures.ts';

let content: Content;
beforeAll(async () => { content = await sampleContent(); });

describe('출생 생성', () => {
  it('같은 시드로 같은 운명과 난수 상태를 생성한다', () => {
    expect(generateBirth(content, 42)).toEqual(generateBirth(content, 42));
  });
  it('완료된 출생은 전체 상태 모델을 만족하며 숨겨진 운명이 공개되지 않는다', () => {
    const state = generateBirth(content, 42);
    expect(gameStateSchema.parse(state)).toEqual(state);
    expect(state.hiddenFateId).not.toBeNull();
    expect(state.hiddenFateRevealed).toBe(false);
    expect(state.stage).toBe('birth'); expect(state.completedEventCount).toBe(0);
    expect(state.currentEventId).toBeNull(); expect(state.choiceHistory).toEqual([]);
    const preview = JSON.stringify(birthPreview(content, state));
    expect(preview).not.toContain(state.hiddenFateId!);
    expect(preview).not.toContain('fate_');
    expect(preview).toContain('미공개');
  });
  it('모순 조합을 차단하고 모든 유효 조합을 생성할 수 있다', () => {
    const combinations = enumerateBirths(content.entities.fantasy_sword!, content.manifest.contentVersion);
    expect(combinations).toHaveLength(6);
    const observed = new Set<string>();
    for (let seed = 0; seed < 256; seed++) {
      const state = generateBirth(content, seed);
      expect(state.traitId === 'magic_absorb' && state.flawId === 'cursed_blade').toBe(false);
      expect(state.hiddenFateId).toBe(state.birthLocationId === 'royal_armory' ? 'crown_witness' : 'sealed_gate_key');
      observed.add([state.birthLocationId, state.traitId, state.flawId, state.hiddenFateId].join('/'));
    }
    expect(observed.size).toBe(6);
  });
  it('위치·특징·결함을 능력치와 플래그·태그·아이템에 반영한다', () => {
    const combinations = enumerateBirths(content.entities.fantasy_sword!, content.manifest.contentVersion);
    const royal = combinations.find(state => state.birthLocationId === 'royal_armory' && state.traitId === 'magic_absorb')!;
    expect(royal.stats).toEqual({ survival: 70, influence: 30, intelligence: 55, freedom: 5, chaos: 30 });
    expect(royal.flags.royal_property).toBe(true); expect(royal.flags.needs_owner).toBe(true);
    expect(royal.tags).toContain('magic_absorb'); expect(royal.items).toContain('mana_fragment');
    const cursed = combinations.find(state => state.birthLocationId === 'ancient_ruins' && state.flawId === 'cursed_blade')!;
    expect(cursed.stats).toEqual({ survival: 60, influence: 30, intelligence: 50, freedom: 30, chaos: 55 });
    expect(cursed.flags.cursed).toBe(true); expect(cursed.tags).toContain('speaking');
  });
  it('후속 선택지 개수 때문에 앞 단계의 가중치가 왜곡되지 않는다', () => {
    let absorb = 0;
    for (let seed = 0; seed < 1000; seed++) if (generateBirth(content, seed).traitId === 'magic_absorb') absorb++;
    expect(absorb).toBeGreaterThan(440); expect(absorb).toBeLessThan(560);
  });
  it('능력치 상하한을 적용하고 원본 콘텐츠와 다른 출생 상태를 변경하지 않는다', () => {
    const altered = structuredClone(content);
    const entity = altered.entities.fantasy_sword!;
    entity.initialStats.survival = 99; entity.initialStats.freedom = 1;
    for (const option of entity.birthLocations) option.effects.push({ op: 'addStat', key: 'survival', value: 100 });
    const before = structuredClone(altered);
    const state = generateBirth(altered, 42);
    expect(state.stats.survival).toBeLessThanOrEqual(100); expect(state.stats.freedom).toBeGreaterThanOrEqual(0);
    expect(altered).toEqual(before);
    state.stats.survival = 0; state.tags.push('changed');
    expect(generateBirth(altered, 42).tags).not.toContain('changed');
    expect(content.entities.fantasy_sword!.initialStats.survival).toBe(70);
  });
  it('출생 후 난수 상태가 추첨을 이어갈 수 있다', () => {
    const state = generateBirth(content, 42);
    const continuous = new SeededRandom(42);
    for (let i = 0; i < 6; i++) continuous.next();
    expect(SeededRandom.restore(state.rng).next()).toBe(continuous.next());
  });
  it('완성할 수 없는 조합은 무한 재추첨 대신 오류를 반환한다', () => {
    const altered = structuredClone(content.entities.fantasy_sword!);
    for (const fate of altered.hiddenFates) fate.conditions = { type: 'flag', key: 'impossible', operator: 'equals', value: true };
    expect(() => enumerateBirths(altered, 'test')).toThrow('출생 조합이 없습니다');
  });
  it('manifest와 옵션 순서 변경에 영향을 받지 않는다', () => {
    const reordered = structuredClone(content);
    for (const entity of Object.values(reordered.entities)) {
      entity.birthLocations.reverse(); entity.traits.reverse(); entity.flaws.reverse(); entity.hiddenFates.reverse();
    }
    expect(generateBirth(reordered, 192)).toEqual(generateBirth(content, 192));
  });
  it('출생 이야기에 데이터의 이름을 넣고 숨겨진 운명을 넣지 않는다', () => {
    const state = generateBirth(content, 42);
    expect(state.birthStory).toContain('살아 있는 마검');
    expect(state.birthStory).not.toMatch(/[{}]/);
    expect(state.birthStory).not.toContain('왕관의 증인'); expect(state.birthStory).not.toContain('봉인된 문의 열쇠');
  });
});

describe('출생 조건 조합', () => {
  it('객체 기본 속성 이름도 설정하지 않은 플래그이면 미보유로 판정한다', () => {
    const state = generateBirth(content, 42);
    expect(matchesBirthCondition({ type: 'flag', key: 'constructor', operator: 'equals', value: false }, state)).toBe(true);
  });
  it('all·any 중첩과 능력치 비교·보유 여부를 판정한다', () => {
    const state = generateBirth(content, 42);
    const condition: BirthCondition = { all: [
      { type: 'world', operator: 'equals', value: 'fantasy' },
      { type: 'entity', operator: 'notEquals', value: 'other' },
      { type: 'stat', key: 'survival', operator: 'gte', value: 0 },
      { type: 'stat', key: 'survival', operator: 'lte', value: 100 },
      { type: 'stat', key: 'survival', operator: 'equals', value: state.stats.survival },
      { type: 'stat', key: 'survival', operator: 'notEquals', value: 0 },
      { type: 'flag', key: 'missing', operator: 'equals', value: false },
      { type: 'item', key: 'missing', operator: 'notEquals', value: true },
      { any: [
        { type: 'tag', key: 'missing', operator: 'equals', value: true },
        { type: 'tag', key: 'weapon', operator: 'equals', value: true },
      ] },
    ] };
    expect(matchesBirthCondition(condition, state)).toBe(true);
    expect(matchesBirthCondition({ any: [{ type: 'flag', key: 'missing', operator: 'equals', value: true }] }, state)).toBe(false);
  });
});
