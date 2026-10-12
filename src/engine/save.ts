import { z } from 'zod';
import type { Content } from '../content/schema.ts';
import { generateBirth } from './birth.ts';
import { advanceLife, startLife } from './game.ts';
import { gameStateSchema, type GameState } from './game-state.ts';

export const SAVE_KEY = 'life-game.save.v1';
const MAX_SAVE_LENGTH = 250_000;
const envelopeSchema = z.strictObject({ saveVersion: z.literal(1), state: gameStateSchema });
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type StorageProvider = () => StoragePort;
export type LoadResult =
  | { status: 'loaded'; state: GameState; message: string }
  | { status: 'empty' | 'invalid' | 'incompatible' | 'unavailable'; message: string };
export type SaveResult = { ok: true; message: string } | { ok: false; message: string };

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return item;
  });
}

/** 저장 상태를 신뢰하지 않고 동일 시드·선택 기록으로 전체 상태를 재현한다. */
export function validateSavedState(content: Content, data: unknown): GameState {
  const saved = gameStateSchema.parse(data);
  if (saved.contentVersion !== content.manifest.contentVersion) throw new Error('콘텐츠 버전이 다릅니다.');
  if (saved.status === 'birth' || saved.choiceHistory.length !== saved.completedEventCount) throw new Error('저장 시점이 올바르지 않습니다.');
  let replay = startLife(content, generateBirth(content, saved.seed));
  for (const entry of saved.choiceHistory) replay = advanceLife(content, replay, entry.eventId, entry.choiceId).state;
  if (canonical(saved) !== canonical(replay)) throw new Error('시드·선택 기록과 저장 상태가 일치하지 않습니다.');
  return replay;
}

export function saveGame(content: Content, state: GameState, storage: StorageProvider): SaveResult {
  try {
    const verified = validateSavedState(content, state);
    const serialized = JSON.stringify({ saveVersion: 1, state: verified });
    if (serialized.length > MAX_SAVE_LENGTH) throw new Error('저장 크기 제한을 초과했습니다.');
    storage().setItem(SAVE_KEY, serialized);
    return { ok: true, message: '자동 저장 완료' };
  } catch {
    return { ok: false, message: '자동 저장에 실패했습니다. 현재 인생은 계속 진행할 수 있지만 새로고침하면 마지막 저장 시점으로 돌아갈 수 있습니다.' };
  }
}

export function loadGame(content: Content, storage: StorageProvider): LoadResult {
  let serialized: string | null;
  try { serialized = storage().getItem(SAVE_KEY); }
  catch { return { status: 'unavailable', message: '브라우저 저장 공간에 접근할 수 없습니다. 저장 없이 새 인생을 시작할 수 있습니다.' }; }
  if (serialized === null) return { status: 'empty', message: '' };
  try {
    if (serialized.length > MAX_SAVE_LENGTH) throw new Error('너무 큰 저장 데이터');
    const raw: unknown = JSON.parse(serialized);
    if (raw && typeof raw === 'object' && 'saveVersion' in raw && raw.saveVersion !== 1) {
      return { status: 'incompatible', message: '지원하지 않는 저장 버전입니다. 새 인생을 시작해 주세요.' };
    }
    if (raw && typeof raw === 'object' && 'state' in raw && raw.state && typeof raw.state === 'object'
      && 'contentVersion' in raw.state && raw.state.contentVersion !== content.manifest.contentVersion) {
      return { status: 'incompatible', message: '콘텐츠가 변경되어 이전 인생을 이어갈 수 없습니다. 새 인생을 시작해 주세요.' };
    }
    const envelope = envelopeSchema.parse(raw);
    return { status: 'loaded', state: validateSavedState(content, envelope.state), message: '저장한 인생을 복원했습니다.' };
  } catch {
    return { status: 'invalid', message: '저장 데이터를 확인할 수 없습니다. 새 인생을 시작해 주세요. 기존 저장은 새 인생을 확정할 때 교체됩니다.' };
  }
}
