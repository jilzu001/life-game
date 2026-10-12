import { afterAll, beforeAll, expect, test } from 'vitest';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { validateDist } from '../scripts/validate-dist.mjs';

let root;
const source = resolve('public');
const page = '<script type="module" src="./assets/game.js"></script>';
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'life-deployment-test-'));
  await cp(source, root, { recursive: true });
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets/game.js'), 'import "./shared.js";');
  await writeFile(join(root, 'assets/shared.js'), 'export function url(e) { return e; }');
  await writeFile(join(root, 'index.html'), page);
  await writeFile(join(root, 'diagnostics.html'), page);
});
afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });

test('실제 콘텐츠 전체가 루트와 GitHub 프로젝트 경로에서 해석된다', async () => {
  const result = await validateDist(root, source);
  expect(result.images).toBe(91);
  expect(result.contentVersion).toBe('0.4.0-mvp');
  expect(result.sha256['index.html']).toMatch(/^[0-9a-f]{64}$/);
});
test('Windows에서 존재하더라도 Linux에서 깨지는 대소문자 경로를 차단한다', async () => {
  await writeFile(join(root, 'index.html'), page.replace('game.js', 'Game.js'));
  try { await expect(validateDist(root, source)).rejects.toThrow('대소문자'); }
  finally { await writeFile(join(root, 'index.html'), page); }
});
test('HTML은 정상이어도 누락된 분리 청크가 있으면 차단한다', async () => {
  await writeFile(join(root, 'assets/game.js'), 'import "./missing.js";');
  try { await expect(validateDist(root, source)).rejects.toThrow('missing.js'); }
  finally { await writeFile(join(root, 'assets/game.js'), 'import "./shared.js";'); }
});
test('오래된 콘텐츠가 남은 빌드를 차단한다', async () => {
  const path = join(root, 'content/manifest.json');
  const original = await readFile(path);
  await writeFile(path, original.toString().replace('0.4.0-mvp', '0.2.0-phase2'));
  try { await expect(validateDist(root, source)).rejects.toThrow('원본과 배포 파일 불일치'); }
  finally { await writeFile(path, original); }
});
