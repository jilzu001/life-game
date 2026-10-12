import { manifestSchema, relativePath, type Content } from './schema.ts';
import { ContentValidationError, parseContent, parseDocument } from './validator.ts';

export type JsonReader = (path: string) => Promise<unknown>;

export function contentUrl(path: string, appBase: URL): URL {
  relativePath.parse(path);
  const base = new URL(appBase);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(path, new URL('content/', base));
}

export function httpJsonReader(appBase: URL, request: typeof fetch = fetch): JsonReader {
  return async path => {
    const response = await request(contentUrl(path, appBase));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  };
}

export async function loadContent(readJson: JsonReader): Promise<Content> {
  async function read(path: string): Promise<unknown> {
    try { return await readJson(path); }
    catch (error) { throw new ContentValidationError([`${path}: 읽기 실패 — ${(error as Error).message}`]); }
  }
  const manifest = parseDocument(manifestSchema, await read('manifest.json'), 'manifest.json');
  const paths = [...manifest.worlds, ...manifest.entities, ...manifest.events, ...manifest.endings];
  if (new Set(paths).size !== paths.length) throw new ContentValidationError(['manifest.json: 중복 파일 경로']);
  const documents = await Promise.all(paths.map(async path => [path, await read(path)] as const));
  return parseContent(manifest, Object.fromEntries(documents));
}
