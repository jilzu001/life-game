import { z } from 'zod';
import {
  manifestSchema, worldSchema, entitySchema, eventSchema, endingSchema,
  type Content, type Condition, type Entity, type Effect,
} from './schema.ts';
import { enumerateBirths, renderBirthStory } from '../engine/birth.ts';

export class ContentValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`콘텐츠 검증 실패:\n${issues.join('\n')}`);
    this.name = 'ContentValidationError';
    this.issues = issues;
  }
}

export function parseDocument<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContentValidationError(result.error.issues.map(issue => `${path}:${issue.path.join('.') || '(루트)'} — ${issue.message}`));
  }
  return result.data;
}

export function parseContent(manifestData: unknown, documents: Record<string, unknown>): Content {
  const manifest = parseDocument(manifestSchema, manifestData, 'manifest.json');
  const issues: string[] = [];
  const filePaths = [...manifest.worlds, ...manifest.entities, ...manifest.events, ...manifest.endings];
  if (new Set(filePaths).size !== filePaths.length) issues.push('manifest.json: 중복 파일 경로');
  const seenIds = new Set<string>();
  function parseGroup<T extends { id: string }>(paths: string[], schema: z.ZodType<T>): Record<string, T> {
    const entries: [string, T][] = [];
    for (const path of paths) {
      try {
        const value = parseDocument(schema, documents[path], path);
        if (seenIds.has(value.id)) issues.push(`${path}: 중복 ID ${value.id}`);
        seenIds.add(value.id);
        entries.push([value.id, value]);
      } catch (error) {
        if (!(error instanceof ContentValidationError)) throw error;
        issues.push(...error.issues);
      }
    }
    return Object.fromEntries(entries);
  }
  const content: Content = {
    manifest,
    worlds: parseGroup(manifest.worlds, worldSchema),
    entities: parseGroup(manifest.entities, entitySchema),
    events: parseGroup(manifest.events, eventSchema),
    endings: parseGroup(manifest.endings, endingSchema),
  };
  if (issues.length) throw new ContentValidationError(issues);
  validateReferences(content);
  return content;
}

export function validateReferences(content: Content): void {
  const issues: string[] = [];
  const fail = (owner: string, message: string) => issues.push(`${owner}: ${message}`);
  function unique(owner: string, values: string[]) {
    if (new Set(values).size !== values.length) fail(owner, '중복 항목');
  }
  function ref(owner: string, group: Record<string, unknown>, id: string) {
    if (!Object.hasOwn(group, id)) fail(owner, `없는 참조 ${id}`);
  }
  function condition(owner: string, value: Condition | undefined, entity?: Entity, birthDepth?: number): void {
    if (!value) return;
    if ('all' in value) { value.all.forEach(child => condition(owner, child, entity, birthDepth)); return; }
    if ('any' in value) { value.any.forEach(child => condition(owner, child, entity, birthDepth)); return; }
    switch (value.type) {
      case 'world': ref(owner, content.worlds, value.value); break;
      case 'entity': ref(owner, content.entities, value.value); break;
      case 'event': ref(owner, content.events, value.eventId); break;
      case 'choice':
        ref(owner, content.events, value.eventId);
        if (content.events[value.eventId] && !content.events[value.eventId]!.choices.some(choice => choice.id === value.choiceId)) {
          fail(owner, `없는 선택 이력 참조 ${value.eventId}/${value.choiceId}`);
        }
        break;
      case 'location': case 'trait': case 'flaw': {
        const group = { location: 'birthLocations', trait: 'traits', flaw: 'flaws' } as const;
        const order = { location: 0, trait: 1, flaw: 2 };
        const kind = value.type;
        if (birthDepth !== undefined && order[kind] >= birthDepth) fail(owner, `아직 추첨하지 않은 ${kind} 참조`);
        const entities = entity ? [entity] : Object.values(content.entities);
        if (!entities.some(candidate => candidate[group[kind]].some(option => option.id === value.value))) {
          fail(owner, `없는 출생 조건 참조 ${value.value}`);
        }
      }
    }
  }
  function effects(owner: string, values: Effect[]) {
    for (const effect of values) if (effect.op === 'transformEntity') ref(owner, content.entities, effect.entityId);
  }
  for (const world of Object.values(content.worlds)) {
    unique(world.id, world.entityIds);
    for (const id of world.entityIds) {
      ref(world.id, content.entities, id);
      if (content.entities[id] && content.entities[id]!.worldId !== world.id) fail(world.id, `소속 세계관 불일치 ${id}`);
    }
  }
  for (const entity of Object.values(content.entities)) {
    ref(entity.id, content.worlds, entity.worldId);
    if (content.worlds[entity.worldId] && !content.worlds[entity.worldId]!.entityIds.includes(entity.id)) {
      fail(entity.id, '세계관의 entityIds에 등록되지 않은 존재');
    }
    unique(entity.id, entity.tags);
    const groups = [entity.birthLocations, entity.traits, entity.flaws, entity.hiddenFates];
    groups.forEach((group, depth) => {
      unique(`${entity.id}/출생그룹${depth}`, group.map(option => option.id));
      for (const option of group) {
        unique(`${entity.id}/${option.id}`, option.flags);
        condition(`${entity.id}/${option.id}`, option.conditions, entity, depth);
      }
    });
    try { renderBirthStory(entity.birthStory, { world: '', entity: '', location: '', trait: '', flaw: '' }); }
    catch (error) { fail(entity.id, (error as Error).message); }
  }
  for (const event of Object.values(content.events)) {
    unique(event.id, event.worldIds); unique(event.id, event.entityIds); unique(event.id, event.entityTags);
    event.worldIds.forEach(id => ref(event.id, content.worlds, id));
    event.entityIds.forEach(id => {
      ref(event.id, content.entities, id);
      if (event.worldIds.length && content.entities[id] && !event.worldIds.includes(content.entities[id]!.worldId)) {
        fail(event.id, `사건의 세계관과 존재 소속 불일치 ${id}`);
      }
    });
    condition(event.id, event.conditions);
    if (event.isFallback && (event.stage !== 'any' || event.entityIds.length || event.entityTags.length
      || event.conditions || event.nextEventId || event.branches.length || event.revealsFate
      || event.choices.some(choice => choice.conditions || choice.nextEventId || choice.branches.length || choice.effects.some(effect => effect.op === 'transformEntity')))) {
      fail(event.id, '안전 사건은 모든 존재·단계에서 무조건 선택 가능하고 분기·변신·운명 공개가 없어야 합니다.');
    }
    unique(event.id, event.choices.map(choice => choice.id));
    for (const source of [event, ...event.choices]) {
      if (source.nextEventId) ref(event.id, content.events, source.nextEventId);
      for (const branch of source.branches) {
        ref(event.id, content.events, branch.nextEventId);
        condition(event.id, branch.conditions);
      }
    }
    for (const choice of event.choices) {
      condition(event.id, choice.conditions); effects(event.id, choice.effects);
      for (const effect of choice.effects) {
        if (effect.op !== 'transformEntity') continue;
        const target = content.entities[effect.entityId];
        const sourceWorlds = event.worldIds.length ? event.worldIds : Object.keys(content.worlds);
        if (target && sourceWorlds.some(world => world !== target.worldId)) fail(event.id, '변신은 현재 세계관 안에서만 가능합니다.');
      }
    }
  }
  for (const ending of Object.values(content.endings)) {
    unique(ending.id, ending.worldIds);
    ending.worldIds.forEach(id => ref(ending.id, content.worlds, id));
    condition(ending.id, ending.conditions);
    if (ending.isDefault && ending.conditions) fail(ending.id, '기본 엔딩은 무조건이어야 합니다.');
  }
  // Phase 1의 빈 엔딩 목록은 허용한다. 엔딩을 등록하기 시작하면 각 세계의 기본 엔딩을 요구한다.
  if (Object.keys(content.endings).length || Object.keys(content.events).length) {
    for (const world of Object.values(content.worlds)) {
      const defaults = Object.values(content.endings).filter(ending => ending.isDefault && ending.worldIds.includes(world.id));
      if (defaults.length !== 1) fail(world.id, '기본 엔딩은 정확히 하나여야 합니다.');
      if (Object.keys(content.events).length) {
        const fallbacks = Object.values(content.events).filter(event => event.isFallback && (!event.worldIds.length || event.worldIds.includes(world.id)));
        if (fallbacks.length !== 1) fail(world.id, '안전 사건은 정확히 하나여야 합니다.');
      }
    }
  }
  if (issues.length) throw new ContentValidationError(issues);
  for (const entity of Object.values(content.entities)) {
    try {
      const births = enumerateBirths(entity, content.manifest.contentVersion);
      const pairs = [
        [entity.birthLocations, 'birthLocationId'], [entity.traits, 'traitId'],
        [entity.flaws, 'flawId'], [entity.hiddenFates, 'hiddenFateId'],
      ] as const;
      for (const [options, key] of pairs) {
        for (const option of options) if (!births.some(birth => birth[key] === option.id)) fail(entity.id, `도달 불가능한 출생 옵션 ${option.id}`);
      }
    } catch (error) { fail(entity.id, (error as Error).message); }
  }
  if (issues.length) throw new ContentValidationError(issues);
}
