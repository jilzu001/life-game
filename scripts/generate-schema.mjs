import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { documentSchemas } from '../src/content/schema.ts';
import { gameStateSchema } from '../src/engine/game-state.ts';

const directory = new URL('../schemas/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, schema] of Object.entries({ ...documentSchemas, 'game-state': gameStateSchema })) {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  await writeFile(new URL(`${name}.schema.json`, directory), `${JSON.stringify(json, null, 2)}\n`);
}
console.log('JSON Schema 6개를 생성했습니다.');
