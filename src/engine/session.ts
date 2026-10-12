import type { Content } from '../content/schema.ts';
import { generateBirth } from './birth.ts';
import { advanceLife, startLife } from './game.ts';
import type { GameState } from './game-state.ts';
import { loadGame, saveGame, type LoadResult, type StorageProvider } from './save.ts';

/** 상태 변경과 자동 저장을 한 진입점에서 처리한다. */
export class GameSession {
  private current: GameState | null = null;
  private content: Content;
  private storage: StorageProvider;
  message = '';

  constructor(content: Content, storage: StorageProvider) { this.content = content; this.storage = storage; }
  get state(): GameState | null { return this.current ? structuredClone(this.current) : null; }

  resume(): LoadResult {
    if (this.current) throw new Error('이미 열린 인생이 있습니다.');
    const result = loadGame(this.content, this.storage);
    if (result.status === 'loaded') this.current = structuredClone(result.state);
    this.message = result.message;
    return result;
  }

  roll(seed: number): GameState {
    if (this.current?.status === 'playing') throw new Error('진행 중에는 출생을 바꿀 수 없습니다.');
    this.current = generateBirth(this.content, seed);
    return this.state!;
  }

  start(): GameState {
    if (!this.current) throw new Error('먼저 출생을 생성해 주세요.');
    this.commit(startLife(this.content, this.current));
    return this.state!;
  }

  choose(eventId: string, choiceId: string, expectedCount: number): GameState {
    if (!this.current || this.current.completedEventCount !== expectedCount) throw new Error('이미 처리된 선택입니다.');
    this.commit(advanceLife(this.content, this.current, eventId, choiceId).state);
    return this.state!;
  }

  private commit(next: GameState): void {
    this.current = next;
    this.message = saveGame(this.content, next, this.storage).message;
  }
}
