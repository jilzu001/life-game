import { readFile } from 'node:fs/promises';
import { loadContent } from '../src/content/loader.ts';
import type { GameEvent } from '../src/content/schema.ts';

// Phase 1의 회귀 기준을 보존한다. 실제 플레이 콘텐츠는 별도 로더로 검증한다.
const root = new URL('./fixtures/phase1/', import.meta.url);
export const readFixture = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, root), 'utf8'));
export const sampleContent = () => loadContent(readFixture);
export const gameplayContent = () => loadContent(async path => JSON.parse(await readFile(new URL(`./fixtures/phase2/${path}`, import.meta.url), 'utf8')));
export const mvpContent = () => loadContent(async path => JSON.parse(await readFile(new URL(`../public/content/${path}`, import.meta.url), 'utf8')));
export function sampleEvent(): GameEvent {
  return {
    schemaVersion: 1, id: 'test_event', worldIds: ['fantasy'], entityIds: ['fantasy_sword'], entityTags: [],
    stage: 'awakening', title: '시험용 사건', description: '스키마 검증용이며 실제 콘텐츠에 등록하지 않는다.',
    image: 'images/entities/magic-sword.svg', weight: 10, branches: [],
    choices: [
      { id: 'speak', text: '말한다', resultText: '말했다.', effects: [{ op: 'setFlag', key: 'spoke', value: true }], branches: [] },
      { id: 'wait', text: '기다린다', resultText: '기다렸다.', effects: [], branches: [] },
    ],
  };
}
