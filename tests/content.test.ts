import { beforeAll, describe, expect, it } from 'vitest';
import { contentUrl, httpJsonReader, loadContent } from '../src/content/loader.ts';
import { conditionSchema, effectSchema, entitySchema, eventSchema, endingSchema, type Content } from '../src/content/schema.ts';
import { parseContent, validateReferences } from '../src/content/validator.ts';
import { generateBirth } from '../src/engine/birth.ts';
import { readFixture, sampleContent, sampleEvent } from './fixtures.ts';

let content: Content;
beforeAll(async () => { content = await sampleContent(); });

describe('엄격한 JSON 규격', () => {
  it('알 수 없는 필드와 연산자, 잘못된 값의 타입을 거부한다', () => {
    const entity = content.entities.fantasy_sword!;
    expect(entitySchema.safeParse({ ...entity, typo: true }).success).toBe(false);
    expect(entitySchema.safeParse({ ...entity, schemaVersion: 2 }).success).toBe(false);
    expect(effectSchema.safeParse({ op: 'eval', code: 'alert(1)' }).success).toBe(false);
    expect(effectSchema.safeParse({ op: 'setStat', key: 'survival', value: 101 }).success).toBe(false);
    expect(effectSchema.safeParse({ op: 'addStat', key: 'strength', value: 10 }).success).toBe(false);
    expect(conditionSchema.safeParse({ type: 'stat', key: 'chaos', operator: 'gt', value: 50 }).success).toBe(false);
    expect(conditionSchema.safeParse({ type: 'flag', key: 'cursed', operator: 'gte', value: true }).success).toBe(false);
    expect(conditionSchema.safeParse({ type: 'stat', key: 'chaos', operator: 'gte', value: '50' }).success).toBe(false);
    expect(conditionSchema.safeParse({ all: [] }).success).toBe(false);
    expect(conditionSchema.safeParse({ all: [], any: [] }).success).toBe(false);
  });
  it.each([0, -1, NaN, Infinity])('출생 가중치 %s를 거부한다', weight => {
    const entity = structuredClone(content.entities.fantasy_sword!);
    entity.traits[0]!.weight = weight;
    expect(entitySchema.safeParse(entity).success).toBe(false);
  });
  it('범위를 벗어난 초기 능력치와 빠진 출생 필드를 거부한다', () => {
    const entity = structuredClone(content.entities.fantasy_sword!);
    entity.initialStats.survival = -1;
    expect(entitySchema.safeParse(entity).success).toBe(false);
    const { timeUnit: _unit, ...missing } = content.entities.fantasy_sword!;
    expect(entitySchema.safeParse(missing).success).toBe(false);
  });
  it('필수 사건 필드와 선택지 2~3개 제약을 검사한다', () => {
    const event = sampleEvent();
    expect(eventSchema.safeParse(event).success).toBe(true);
    event.choices.pop(); expect(eventSchema.safeParse(event).success).toBe(false);
  });
  it('미래 엔진에서 사용할 이력 조건·변신 효과·조건 분기를 선언할 수 있다', () => {
    const event = sampleEvent();
    event.conditions = { all: [
      { type: 'event', eventId: 'test_event', operator: 'equals', value: true },
      { type: 'choice', eventId: 'test_event', choiceId: 'speak', operator: 'equals', value: true },
    ] };
    event.choices[0]!.effects.push({ op: 'transformEntity', entityId: 'fantasy_sword' });
    event.choices[0]!.branches.push({ conditions: { type: 'flag', key: 'spoke', operator: 'equals', value: true }, nextEventId: 'test_event' });
    expect(eventSchema.safeParse(event).success).toBe(true);
  });
  it.each(['/images/x.svg', '../images/x.svg', 'https://example.com/x.svg', 'images/x.svg?url=1', 'images\\x.svg'])('안전하지 않은 이미지 경로 %s를 거부한다', image => {
    expect(entitySchema.safeParse({ ...content.entities.fantasy_sword!, image }).success).toBe(false);
  });
});

describe('콘텐츠 참조와 출생 도달성', () => {
  it('manifest 파일만 읽고 검증된 콘텐츠를 반환한다', async () => {
    const paths: string[] = [];
    await loadContent(async path => { paths.push(path); return readFixture(path); });
    expect(paths).toEqual(['manifest.json', 'worlds/fantasy.json', 'entities/fantasy_sword.json']);
    expect(content.manifest.contentVersion).toBe('0.1.0-phase1');
  });
  it('중복 파일 경로와 중복 콘텐츠 ID를 거부한다', async () => {
    await expect(loadContent(async path => path === 'manifest.json' ? { ...content.manifest, worlds: ['worlds/fantasy.json', 'worlds/fantasy.json'] } : readFixture(path))).rejects.toThrow('중복 파일');
    const manifest = { ...content.manifest, worlds: ['worlds/fantasy.json', 'worlds/duplicate.json'] };
    expect(() => parseContent(manifest, {
      'worlds/fantasy.json': content.worlds.fantasy,
      'worlds/duplicate.json': content.worlds.fantasy,
      'entities/fantasy_sword.json': content.entities.fantasy_sword,
    })).toThrow('중복 ID');
  });
  it('잘못된 세계관과 존재 참조를 거부한다', () => {
    const broken = structuredClone(content);
    broken.worlds.fantasy!.entityIds.push('missing');
    broken.entities.fantasy_sword!.worldId = 'missing';
    expect(() => validateReferences(broken)).toThrow('없는 참조');
  });
  it('없는 직접 분기·조건 분기·선택 이력·변신 대상을 거부한다', () => {
    const broken = structuredClone(content);
    const event = sampleEvent();
    broken.events[event.id] = event;
    event.nextEventId = 'missing_direct';
    event.branches.push({ conditions: { type: 'flag', key: 'test', operator: 'equals', value: true }, nextEventId: 'missing_branch' });
    event.conditions = { type: 'choice', eventId: event.id, choiceId: 'missing_choice', operator: 'equals', value: true };
    event.choices[0]!.effects.push({ op: 'transformEntity', entityId: 'missing_entity' });
    expect(() => validateReferences(broken)).toThrow('missing_direct');
    expect(() => validateReferences(broken)).toThrow('missing_branch');
    expect(() => validateReferences(broken)).toThrow('missing_choice');
    expect(() => validateReferences(broken)).toThrow('missing_entity');
  });
  it('도달 불가능한 출생 옵션과 아직 추첨하지 않은 조건 참조를 거부한다', () => {
    const unreachable = structuredClone(content);
    unreachable.entities.fantasy_sword!.traits[0]!.conditions = { type: 'flag', key: 'never_set', operator: 'equals', value: true };
    expect(() => validateReferences(unreachable)).toThrow('도달 불가능한 출생 옵션');
    const forward = structuredClone(content);
    forward.entities.fantasy_sword!.birthLocations[0]!.conditions = { type: 'trait', operator: 'equals', value: 'magic_absorb' };
    expect(() => validateReferences(forward)).toThrow('아직 추첨하지 않은');
  });
  it('출생 이야기의 오타와 숨겨진 운명 치환을 거부한다', () => {
    const broken = structuredClone(content);
    broken.entities.fantasy_sword!.birthStory = '{fate}';
    expect(() => validateReferences(broken)).toThrow('알 수 없는 치환자');
  });
  it('엔딩을 등록하면 세계관별 무조건 기본 엔딩을 요구한다', () => {
    const altered = structuredClone(content);
    const ending = endingSchema.parse({
      schemaVersion: 1, id: 'test_ending', worldIds: ['fantasy'], title: '시험 엔딩', description: '규격만 검증한다.',
      image: 'images/fallback.svg', priority: 0, isDefault: false,
    });
    altered.endings[ending.id] = ending;
    expect(() => validateReferences(altered)).toThrow('기본 엔딩');
    ending.isDefault = true;
    expect(() => validateReferences(altered)).not.toThrow();
  });
  it('엔진 변경 없이 manifest와 파일 등록만으로 세계관과 존재를 추가한다', async () => {
    const world = { ...content.worlds.fantasy!, id: 'other_world', name: '시험 세계', entityIds: ['other_entity'] };
    const entity = { ...content.entities.fantasy_sword!, id: 'other_entity', name: '시험 존재', worldId: world.id };
    const expandedManifest = { ...content.manifest, worlds: [...content.manifest.worlds, 'worlds/other.json'], entities: [...content.manifest.entities, 'entities/other.json'] };
    const expanded = await loadContent(async path => {
      if (path === 'manifest.json') return expandedManifest;
      if (path === 'worlds/other.json') return world;
      if (path === 'entities/other.json') return entity;
      return readFixture(path);
    });
    expect(Object.keys(expanded.entities)).toHaveLength(2);
    const worlds = new Set(Array.from({ length: 32 }, (_, seed) => generateBirth(expanded, seed).worldId));
    expect(worlds).toEqual(new Set(['fantasy', 'other_world']));
  });
});

describe('배포 경로와 로딩 오류', () => {
  it.each(['https://example.com/', 'https://example.com/life-game/', 'https://example.com/nested/life/'])('기본 경로 %s 아래에서 콘텐츠를 해석한다', base => {
    expect(contentUrl('images/fallback.svg', new URL(base)).href).toBe(`${base}content/images/fallback.svg`);
  });
  it('하위 경로 HTTP 로더가 이미지와 JSON에 같은 기준 경로를 사용한다', async () => {
    const paths: string[] = [];
    const request: typeof fetch = async input => {
      const url = new URL(String(input)); paths.push(url.pathname);
      const data = await readFixture(url.pathname.replace('/life-game/content/', ''));
      return new Response(JSON.stringify(data), { status: 200 });
    };
    await loadContent(httpJsonReader(new URL('https://example.com/life-game/'), request));
    expect(paths).toContain('/life-game/content/entities/fantasy_sword.json');
  });
  it('없는 파일과 잘못된 JSON에 파일명을 포함한 오류를 반환한다', async () => {
    const notFound: typeof fetch = async () => new Response('없음', { status: 404 });
    await expect(loadContent(httpJsonReader(new URL('https://example.com/'), notFound))).rejects.toThrow('manifest.json: 읽기 실패 — manifest.json: HTTP 404');
    await expect(loadContent(async () => JSON.parse('{broken'))).rejects.toThrow('manifest.json: 읽기 실패');
  });
});
