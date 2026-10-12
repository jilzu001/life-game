import { httpJsonReader, loadContent } from './content/loader.ts';
import { GameSession } from './engine/session.ts';
import { startView } from './ui/start.ts';
import { birthView } from './ui/birth.ts';
import { gameView } from './ui/game.ts';
import { endingView } from './ui/ending.ts';
import { syncEmbedHeight } from './ui/embed.ts';
import { button, el, stageNames } from './ui/shared.ts';
import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
const announcement = document.querySelector<HTMLElement>('#announcement')!;
const base = new URL(import.meta.env.BASE_URL, document.baseURI);
syncEmbedHeight(app);

async function main(): Promise<void> {
  const content = await loadContent(httpJsonReader(base));
  const context = { content, base };
  const session = new GameSession(content, () => window.localStorage);
  const restored = session.resume();
  let landing = true;
  let error = '';
  let acting = false;
  const loadWarning = restored.status !== 'loaded' && restored.status !== 'empty' ? restored.message : '';

  function randomBirth(): void {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    session.roll(seed); landing = false;
  }
  function act(action: () => void): void {
    if (acting) return;
    acting = true;
    try { action(); error = ''; render(true); }
    catch (cause) { error = (cause as Error).message; render(false); }
    finally { acting = false; }
  }
  function render(focus = false): void {
    const state = session.state;
    app.dataset.world = state?.worldId ?? '';
    app.dataset.screen = landing ? 'start' : state?.status ?? 'start';
    const shell = el('div', 'app-shell');
    const header = el('header', 'site-header');
    const brand = el('a', 'brand'); brand.href = '#main-content';
    const mark = el('span', 'brand-mark', '∞'); mark.setAttribute('aria-hidden', 'true');
    brand.append(mark, el('span', '', '무한생'), el('span', 'brand-en', 'LIFE'));
    header.append(brand, el('span', 'header-note', '선택이 모여, 하나의 삶'));
    const main = el('main', 'main-content'); main.id = 'main-content';
    if (landing) main.append(startView(context, state, () => act(randomBirth), () => act(() => { landing = false; })));
    else if (state?.status === 'birth') main.append(birthView(context, state, () => act(randomBirth), () => act(() => { session.start(); })));
    else if (state?.status === 'playing') main.append(gameView(context, state, (eventId, choiceId, count) => act(() => { session.choose(eventId, choiceId, count); })));
    else if (state?.status === 'ended') main.append(endingView(context, state, () => act(randomBirth), () => act(() => { landing = true; })));
    if (error) { const warning = el('p', 'notice notice-error', error); warning.setAttribute('role', 'alert'); main.append(warning); }
    const footer = el('footer', 'site-footer');
    let saveText = state && state.status !== 'birth' ? session.message : loadWarning;
    if (!saveText) saveText = state?.status === 'birth' ? '인생을 시작하면 출생이 확정됩니다.' : '선택한 이야기는 이 브라우저에 저장됩니다.';
    const status = el('p', 'save-status', saveText);
    if (saveText.includes('실패') || saveText.includes('접근할 수 없') || saveText.includes('확인할 수 없') || saveText.includes('이어갈 수 없')) status.classList.add('save-warning');
    footer.append(status, el('p', 'sample-note', `${Object.keys(content.worlds).length}개의 세계, ${Object.keys(content.entities).length}가지 모습으로 만나는 삶.`));
    shell.append(header, main, footer); app.replaceChildren(shell);
    if (focus) {
      main.querySelector<HTMLElement>('[data-screen-title]')?.focus({ preventScroll: window.parent === window });
      window.scrollTo({ top: 0, behavior: 'instant' });
      announcement.textContent = state && !landing ? `${stageNames[state.stage]}. ${state.completedEventCount}개의 선택을 마쳤습니다.` : '무한생 시작 화면';
    }
  }
  render();
}

main().catch(() => {
  const failure = el('main', 'loading'); failure.id = 'main-content';
  const heading = el('h1', '', '이야기를 불러오지 못했어요');
  const message = el('p', '', '연결 상태를 확인한 뒤 다시 시도해 주세요. 저장된 인생은 그대로 남아 있습니다.');
  message.setAttribute('role', 'alert');
  failure.append(heading, message, button('다시 불러오기', () => window.location.reload()));
  app.replaceChildren(failure);
});
