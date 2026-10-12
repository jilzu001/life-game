import type { Content } from './schema.ts';
import { simulateContent } from './simulation.ts';

export const MVP_WORLDS = ['fantasy', 'zombie', 'cyberpunk', 'space', 'hunter', 'reality'] as const;
export const MVP_SEEDS = Array.from({ length: 4096 }, (_, seed) => seed);

/** 안전 대체 사건을 일반 콘텐츠 수량에 포함하지 않는다. */
export function mvpInventory(content: Content) {
  const events = Object.values(content.events);
  const normal = events.filter(event => !event.isFallback);
  const universal = normal.filter(event => !event.worldIds.length && !event.entityIds.length && !event.entityTags.length);
  const worlds = Object.values(content.worlds).map(world => {
    const dedicated = normal.filter(event => event.worldIds.length === 1 && event.worldIds[0] === world.id && event.entityIds.length === 1 && !event.entityTags.length);
    return {
      id: world.id, name: world.name,
      entities: world.entityIds.map(id => ({ id, events: dedicated.filter(event => event.entityIds[0] === id).length })),
      common: normal.filter(event => event.worldIds.length === 1 && event.worldIds[0] === world.id && !event.entityIds.length && !event.entityTags.length).length,
      dedicated: dedicated.length,
      endings: Object.values(content.endings).filter(ending => ending.worldIds.includes(world.id)).length,
      fallback: events.filter(event => event.isFallback && event.worldIds.includes(world.id)).length,
    };
  });
  return { worlds, entities: Object.keys(content.entities).length, normalEvents: normal.length, universal: universal.length, fallbackEvents: events.length - normal.length, endings: Object.keys(content.endings).length };
}

export function validateMvpInventory(content: Content): ReturnType<typeof mvpInventory> {
  const report = mvpInventory(content);
  const errors: string[] = [];
  if (Object.keys(content.worlds).sort().join() !== [...MVP_WORLDS].sort().join()) errors.push('명세의 6개 세계관이 필요합니다.');
  if (report.entities !== 30 || report.endings !== 30) errors.push('출생 유형과 엔딩은 각각 30개여야 합니다.');
  if (report.normalEvents < 180 || report.universal < 18) errors.push('안전 사건을 제외한 일반 사건 180개와 범용 돌발 18개가 필요합니다.');
  for (const world of report.worlds) {
    if (world.entities.length !== 5 || world.endings !== 5 || world.common < 12 || world.fallback !== 1) errors.push(`${world.id}: 존재 5·엔딩 5·공통 사건 12 이상·안전 사건 1이 필요합니다.`);
    for (const entity of world.entities) if (entity.events < 3) errors.push(`${entity.id}: 전용 사건이 3개 미만입니다.`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return report;
}

/** 각 세계를 고르게 표집한다. 해당 세계의 출생 확률·사건·분기는 원본 값을 사용한다. */
export function simulateMvpContent(content: Content) {
  return MVP_WORLDS.map(worldId => {
    const scoped: Content = {
      ...content, worlds: { [worldId]: content.worlds[worldId]! },
      entities: Object.fromEntries(Object.entries(content.entities).filter(([, entity]) => entity.worldId === worldId)),
      events: Object.fromEntries(Object.entries(content.events).filter(([, event]) => !event.worldIds.length || event.worldIds.includes(worldId))),
      endings: Object.fromEntries(Object.entries(content.endings).filter(([, ending]) => ending.worldIds.includes(worldId))),
    };
    const { observed, ...result } = simulateContent(scoped, MVP_SEEDS);
    return { worldId, ...result, observedCount: observed.length };
  });
}
