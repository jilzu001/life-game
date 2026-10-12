import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { loadContent } from '../src/content/loader.ts';
import { documentSchemas, imagePathSchema } from '../src/content/schema.ts';
import { gameStateSchema } from '../src/engine/game-state.ts';
import { validateMvpInventory, simulateMvpContent } from '../src/content/mvp.ts';

const root = new URL('../public/content/', import.meta.url);
try {
  const content = await loadContent(async path => JSON.parse(await readFile(new URL(path, root), 'utf8')));
  for (const [name, schema] of Object.entries({ ...documentSchemas, 'game-state': gameStateSchema })) {
    const saved = JSON.parse(await readFile(new URL(`../schemas/${name}.schema.json`, import.meta.url), 'utf8'));
    if (JSON.stringify(saved) !== JSON.stringify(z.toJSONSchema(schema, { target: 'draft-2020-12' }))) {
      throw new Error(`${name}: JSON Schema가 오래되었습니다. npm run schema:generate를 실행하세요.`);
    }
  }
  const records = [...Object.values(content.worlds), ...Object.values(content.entities), ...Object.values(content.events), ...Object.values(content.endings)];
  const images = new Set(['images/fallback.svg', ...records.map(record => record.image)]);
  for (const path of images) {
    imagePathSchema.parse(path);
    const image = await readFile(new URL(path, root));
    if (path.endsWith('.svg')) {
      const svg = image.toString('utf8');
      if (!/<svg\b[^>]*\bviewBox\s*=/i.test(svg)) throw new Error(`${path}: SVG viewBox가 없습니다.`);
      if (/<\s*(script|foreignObject|iframe|image|use|style|animate\w*|set)\b|\bon[a-z]+\s*=|(?:href|src)\s*=|url\s*\(|<!DOCTYPE|<!ENTITY|<\?/i.test(svg)) {
        throw new Error(`${path}: 스크립트·외부 참조 또는 지원하지 않는 SVG 요소가 있습니다.`);
      }
    } else if (image.toString('ascii', 0, 4) !== 'RIFF' || image.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error(`${path}: 정상 WebP 파일이 아닙니다.`);
    }
  }
  if (Object.keys(content.events).length) {
    const inventory = validateMvpInventory(content);
    const simulations = simulateMvpContent(content);
    for (const simulation of simulations) {
      if (simulation.errors.length || simulation.missing.length || simulation.fallbackVisits) {
        throw new Error([simulation.worldId, ...simulation.errors, ...simulation.missing.map(key => `고정 시드 검사에서 미도달: ${key}`), `안전 사건 사용 ${simulation.fallbackVisits}회`].join('\n'));
      }
      console.log(`${simulation.worldId}: ${simulation.runs}회 완주, 모든 사건·선택·분기·엔딩 도달, 안전 사건 사용 0회`);
    }
    if (process.argv.includes('--report')) await writeFile(new URL('../docs/qa/phase4-simulation.json', import.meta.url), JSON.stringify({ contentVersion: content.manifest.contentVersion, inventory, simulations }, null, 2) + '\n');
    console.log(`MVP 수량: 일반 사건 ${inventory.normalEvents}개 (범용 ${inventory.universal}개 포함), 안전 사건 별도 ${inventory.fallbackEvents}개`);
  }
  console.log(`콘텐츠 검증 통과: 세계관 ${Object.keys(content.worlds).length}, 존재 ${Object.keys(content.entities).length}, 사건 ${Object.keys(content.events).length}, 엔딩 ${Object.keys(content.endings).length}, 이미지 ${images.size}`);
  console.log('외부 배포 환경은 Phase 5에서 검증합니다.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
