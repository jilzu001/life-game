import type { BirthCondition, BirthEffect, BirthOption, Content, Entity } from '../content/schema.ts';
import type { GameState } from './game-state.ts';
import { SeededRandom } from './randomness.ts';

const optionGroups = ['birthLocations', 'traits', 'flaws', 'hiddenFates'] as const;
const stateKeys = ['birthLocationId', 'traitId', 'flawId', 'hiddenFateId'] as const;
const storyKeys = ['world', 'entity', 'location', 'trait', 'flaw'] as const;
export const MAX_BIRTH_SEARCH_NODES = 100_000;

// 출생 조합 필터에 필요한 판정만 제공한다. 사건 이력 판정은 Phase 2 범위다.
export function matchesBirthCondition(condition: BirthCondition | undefined, state: GameState): boolean {
  if (!condition) return true;
  if ('all' in condition) return condition.all.every(child => matchesBirthCondition(child, state));
  if ('any' in condition) return condition.any.some(child => matchesBirthCondition(child, state));
  if (condition.type === 'stat') {
    const current = state.stats[condition.key];
    switch (condition.operator) {
      case 'gte': return current >= condition.value;
      case 'lte': return current <= condition.value;
      case 'equals': return current === condition.value;
      case 'notEquals': return current !== condition.value;
    }
  }
  let actual: string | boolean | null;
  switch (condition.type) {
    case 'flag': actual = Object.hasOwn(state.flags, condition.key) ? state.flags[condition.key]! : false; break;
    case 'tag': actual = state.tags.includes(condition.key); break;
    case 'item': actual = state.items.includes(condition.key); break;
    case 'world': actual = state.worldId; break;
    case 'entity': actual = state.entityId; break;
    case 'location': actual = state.birthLocationId; break;
    case 'trait': actual = state.traitId; break;
    case 'flaw': actual = state.flawId; break;
  }
  return condition.operator === 'equals' ? actual === condition.value : actual !== condition.value;
}

export function applyBirthEffect(state: GameState, effect: BirthEffect): void {
  switch (effect.op) {
    case 'addStat': state.stats[effect.key] = Math.max(0, Math.min(100, state.stats[effect.key] + effect.value)); break;
    case 'setStat': state.stats[effect.key] = effect.value; break;
    case 'setFlag': state.flags[effect.key] = effect.value; break;
    case 'addTag': if (!state.tags.includes(effect.key)) state.tags.push(effect.key); break;
    case 'removeTag': state.tags = state.tags.filter(tag => tag !== effect.key); break;
    case 'addItem': if (!state.items.includes(effect.key)) state.items.push(effect.key); break;
    case 'removeItem': state.items = state.items.filter(item => item !== effect.key); break;
  }
}

function initialState(entity: Entity, contentVersion: string, seed: number): GameState {
  return {
    schemaVersion: 1, contentVersion, seed, rng: { algorithm: 'mulberry32-v1', state: seed },
    status: 'birth', worldId: entity.worldId, entityId: entity.id, birthEntityId: entity.id,
    birthLocationId: null, traitId: null, flawId: null, hiddenFateId: null, hiddenFateRevealed: false,
    stage: 'birth', currentEventId: null, endingId: null,
    stats: { ...entity.initialStats }, tags: [...entity.tags], flags: {}, items: [],
    visitedEventIds: [], choiceHistory: [], completedEventCount: 0, birthStory: '',
  };
}

function withOption(state: GameState, option: BirthOption, depth: number): GameState {
  const next = structuredClone(state);
  next[stateKeys[depth]!] = option.id;
  for (const flag of option.flags) next.flags[flag] = true;
  for (const effect of option.effects) applyBirthEffect(next, effect);
  return next;
}

/** 유효한 조합을 먼저 확정해 무제한 재추첨으로 인한 진행 불가를 방지한다. */
export function enumerateBirths(entity: Entity, contentVersion: string, seed = 0): GameState[] {
  const results: GameState[] = [];
  let visited = 0;
  function visit(state: GameState, depth: number): void {
    if (++visited > MAX_BIRTH_SEARCH_NODES) throw new Error(`${entity.id}: 출생 조합 탐색 상한을 초과했습니다.`);
    if (depth === optionGroups.length) { results.push(state); return; }
    for (const option of entity[optionGroups[depth]!]) {
      if (matchesBirthCondition(option.conditions, state)) visit(withOption(state, option, depth), depth + 1);
    }
  }
  visit(initialState(entity, contentVersion, seed), 0);
  if (!results.length) throw new Error(`${entity.id}: 조건을 만족하는 출생 조합이 없습니다.`);
  return results;
}

export function renderBirthStory(template: string, values: Record<typeof storyKeys[number], string>): string {
  return template.replace(/\{([^{}]+)\}/g, (_, key: string) => {
    if (!storyKeys.includes(key as typeof storyKeys[number])) throw new Error(`출생 이야기의 알 수 없는 치환자: ${key}`);
    return values[key as typeof storyKeys[number]];
  });
}

export function generateBirth(content: Content, seed: number): GameState {
  const random = new SeededRandom(seed);
  // manifest 순서가 바뀌어도 같은 시드의 결과를 유지한다.
  const world = random.weighted(Object.values(content.worlds).sort((a, b) => a.id.localeCompare(b.id, 'en')));
  const entity = random.weighted(world.entityIds.map(id => {
    const found = content.entities[id];
    if (!found) throw new Error(`존재 참조를 찾을 수 없습니다: ${id}`);
    return found;
  }).sort((a, b) => a.id.localeCompare(b.id, 'en')));
  let candidates = enumerateBirths(entity, content.manifest.contentVersion, seed);
  for (let depth = 0; depth < optionGroups.length; depth++) {
    const stateKey = stateKeys[depth]!;
    const validIds = new Set(candidates.map(candidate => candidate[stateKey]));
    const options = entity[optionGroups[depth]!].filter(option => validIds.has(option.id))
      .sort((a, b) => a.id.localeCompare(b.id, 'en'));
    const selected = random.weighted(options);
    candidates = candidates.filter(candidate => candidate[stateKey] === selected.id);
  }
  const state = candidates[0]!;
  state.rng = random.snapshot();
  state.birthStory = renderBirthStory(entity.birthStory, {
    world: world.name, entity: entity.name,
    location: entity.birthLocations.find(option => option.id === state.birthLocationId)!.name,
    trait: entity.traits.find(option => option.id === state.traitId)!.name,
    flaw: entity.flaws.find(option => option.id === state.flawId)!.name,
  });
  return state;
}

/** 개발 화면에도 숨겨진 운명의 ID·설명·플래그를 전달하지 않는다. */
export function birthPreview(content: Content, state: GameState) {
  const entity = content.entities[state.birthEntityId]!;
  return {
    seed: state.seed, world: content.worlds[state.worldId]!.name, entity: entity.name,
    location: entity.birthLocations.find(option => option.id === state.birthLocationId)!.name,
    trait: entity.traits.find(option => option.id === state.traitId)!.name,
    flaw: entity.flaws.find(option => option.id === state.flawId)!.name,
    hiddenFate: '미공개', story: state.birthStory, stats: { ...state.stats },
  };
}
