import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadContent } from '../src/content/loader.ts';

async function inventory(root, prefix = '') {
  const result = new Map();
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix + entry.name;
    // OneDrive 동기화 중 디렉터리 항목의 파일 종류가 일시적으로 unknown일 수 있다.
    // lstat으로 재확인하되 실제 심볼릭 링크는 따라가지 않는다.
    const kind = entry.isFile() || entry.isDirectory() ? entry : await lstat(join(root, path));
    if (kind.isDirectory()) {
      for (const pair of await inventory(root, path + '/')) result.set(...pair);
    } else if (kind.isFile()) result.set(path, await readFile(join(root, path)));
    else throw new Error(`${path}: 배포 폴더에 링크 등 지원하지 않는 항목이 있습니다.`);
  }
  return result;
}

// 실제 파일명을 열거하므로 Windows에서도 Linux의 대소문자 구분을 검사한다.
export async function validateDist(distRoot, publicRoot) {
  const files = await inventory(distRoot);
  const source = await inventory(publicRoot);
  const requireFile = path => {
    if (!files.has(path)) throw new Error(`${path}: 배포 파일 누락 또는 대소문자 불일치`);
    return files.get(path);
  };
  for (const [path, bytes] of source) {
    if (!requireFile(path).equals(bytes)) throw new Error(`${path}: 원본과 배포 파일 불일치`);
  }
  for (const path of files.keys()) {
    if (/(^|\/)(?:node_modules|src|tests|\.git)(\/|$)|\.(?:ts|map)$/.test(path)) {
      throw new Error(`${path}: 배포 대상이 아닌 파일`);
    }
  }
  const content = await loadContent(async path => JSON.parse(requireFile('content/' + path).toString('utf8')));
  const records = [...Object.values(content.worlds), ...Object.values(content.entities), ...Object.values(content.events), ...Object.values(content.endings)];
  const images = new Set(['images/fallback.svg', ...records.map(record => record.image)]);
  for (const path of images) requireFile('content/' + path);

  // HTML의 상대 자원 경로가 루트와 프로젝트 하위 주소 모두에서 같은 파일을 가리켜야 한다.
  let references = 0;
  for (const page of ['index.html', 'diagnostics.html', 'embed-example.html']) {
    const html = requireFile(page).toString('utf8');
    const refs = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
    for (const ref of refs) {
      if (ref.startsWith('#')) continue;
      if (/^(?:[a-z]+:|\/)/i.test(ref)) throw new Error(`${page}: 상대 경로가 아닌 참조 ${ref}`);
      for (const prefix of ['/', '/life-game/']) {
        const base = new URL(prefix, 'https://pages.example');
        const url = new URL(ref, new URL(page, base));
        if (!url.pathname.startsWith(prefix)) throw new Error(`${page}: 배포 경로 이탈 ${ref}`);
        const path = decodeURIComponent(url.pathname.slice(prefix.length));
        requireFile(path.endsWith('/') || path === '' ? path + 'index.html' : path);
      }
      references++;
    }
  }
  requireFile('life-embed.js');
  // Vite가 분리한 청크와 CSS의 로컬 자원도 확인한다.
  for (const [path, bytes] of files) {
    if (!path.startsWith('assets/') || !/\.(?:js|css)$/.test(path)) continue;
    const text = bytes.toString('utf8');
    const refs = path.endsWith('.css')
      ? [...text.matchAll(/url\(["']?([^\s)'"?]+)["']?\)/g)]
      : [...text.matchAll(/["'](\.\.?\/[^"'\s]+\.(?:js|css))["']/g)];
    for (const match of refs) {
      if (match[1].startsWith('data:') || match[1].startsWith('#')) continue;
      const url = new URL(match[1], 'https://pages.example/life-game/' + path);
      if (!url.pathname.startsWith('/life-game/')) throw new Error(`${path}: 청크 경로 이탈`);
      requireFile(decodeURIComponent(url.pathname.slice('/life-game/'.length)));
    }
  }
  return {
    contentVersion: content.manifest.contentVersion,
    files: files.size,
    bytes: [...files.values()].reduce((total, bytes) => total + bytes.length, 0),
    images: images.size,
    htmlReferences: references,
    sha256: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => [path, createHash('sha256').update(bytes).digest('hex')])),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = await validateDist(resolve('dist'), resolve('public'));
    console.log(`배포 검사 통과: ${report.files}개 파일, ${report.images}개 이미지, ${report.bytes}바이트. 루트·/life-game/ 경로 검사 통과.`);
    if (process.argv.includes('--report')) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile('docs/qa/phase5-dist.json', JSON.stringify(report, null, 2) + '\n');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
