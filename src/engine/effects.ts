import type { Content, Effect } from '../content/schema.ts';
import { applyBirthEffect } from './birth.ts';
import type { GameState } from './game-state.ts';

/** 전체 효과가 성공한 복사본만 반환한다. 실패 시 입력 상태는 그대로다. */
export function applyEffects(content: Content, state: GameState, effects: readonly Effect[]): GameState {
  const next = structuredClone(state);
  for (const effect of effects) {
    if (effect.op !== 'transformEntity') { applyBirthEffect(next, effect); continue; }
    const entity = Object.hasOwn(content.entities, effect.entityId) ? content.entities[effect.entityId] : undefined;
    if (!entity || entity.worldId !== next.worldId) throw new Error(`현재 세계에서 변신할 수 없는 존재: ${effect.entityId}`);
    next.entityId = entity.id;
    next.tags = [...new Set([...next.tags, ...entity.tags])];
  }
  return next;
}
