import { contentUrl, httpJsonReader, loadContent } from './content/loader.ts';
import { birthPreview } from './engine/birth.ts';
import { availableChoices } from './engine/events.ts';
import { GameSession } from './engine/session.ts';
import './diagnostics.css';

const app = document.querySelector<HTMLElement>('#app')!;
const base = new URL(import.meta.env.BASE_URL, document.baseURI);

async function main(): Promise<void> {
  const content = await loadContent(httpJsonReader(base));
  const session = new GameSession(content, () => window.localStorage);
  const restored = session.resume();
  if (restored.status !== 'loaded') session.roll(42);
  app.replaceChildren();
  const title = document.createElement('h1');
  title.textContent = '무한생 · Phase 2 엔진 검증';
  const notice = document.createElement('p');
  notice.textContent = '출생부터 12개 사건과 엔딩까지 확인하는 개발 화면입니다. 인생 시작과 선택 직후 자동 저장되며, 새로고침하면 이어집니다.';
  const form = document.createElement('form');
  const label = document.createElement('label');
  label.textContent = '재현용 시드 ';
  const input = document.createElement('input');
  input.name = 'seed'; input.type = 'number'; input.min = '0'; input.max = '4294967295'; input.step = '1'; input.required = true; input.value = String(session.state!.seed);
  label.append(input);
  const button = document.createElement('button');
  button.type = 'submit'; button.textContent = '출생 생성 확인';
  form.append(label, button);
  const illustration = document.createElement('img');
  illustration.width = 240; illustration.height = 160;
  illustration.addEventListener('error', () => {
    if (illustration.dataset.fallback) { illustration.hidden = true; return; }
    illustration.dataset.fallback = 'true';
    illustration.src = contentUrl('images/fallback.svg', base).href;
  });
  const result = document.createElement('pre');
  result.id = 'birth-result';
  const errorMessage = document.createElement('p'); errorMessage.setAttribute('role', 'alert');
  const progress = document.createElement('p'); progress.id = 'progress';
  const sceneTitle = document.createElement('h2');
  const description = document.createElement('p');
  const fate = document.createElement('p');
  const start = document.createElement('button'); start.textContent = '인생 시작';
  const choices = document.createElement('div'); choices.className = 'choices';
  const saveNotice = document.createElement('p'); saveNotice.setAttribute('role', 'status');
  const historyTitle = document.createElement('h2'); historyTitle.textContent = '선택 기록';
  const history = document.createElement('ol');
  app.append(title, notice, form, progress, illustration, sceneTitle, description, fate, start, choices, errorMessage, saveNotice, result, historyTitle, history);
  const stageNames = { birth: '탄생', awakening: '각성', growth: '성장', crisis: '위기', transition: '전환', climax: '절정', conclusion: '결말' };
  function render(): void {
    const state = session.state!;
    const entity = content.entities[state.entityId]!;
    const birthEntity = content.entities[state.birthEntityId]!;
    const destiny = birthEntity.hiddenFates.find(option => option.id === state.hiddenFateId)!;
    input.disabled = state.status === 'playing'; button.disabled = state.status === 'playing';
    start.hidden = state.status !== 'birth';
    progress.textContent = `${stageNames[state.stage]} · 완료한 사건 ${state.completedEventCount}/12 · 현재 존재: ${entity.name}`;
    illustration.hidden = false; delete illustration.dataset.fallback;
    illustration.src = contentUrl(entity.image, base).href; illustration.alt = entity.name;
    fate.textContent = state.hiddenFateRevealed ? `드러난 운명: ${destiny.name} — ${destiny.description}` : '숨겨진 운명: 미공개';
    saveNotice.textContent = session.message;
    choices.replaceChildren();
    if (state.status === 'playing') {
      const event = content.events[state.currentEventId!]!;
      sceneTitle.textContent = event.title; description.textContent = event.description;
      for (const choice of availableChoices(event, state)) {
        const option = document.createElement('button'); option.textContent = choice.text;
        option.addEventListener('click', () => act(() => session.choose(event.id, choice.id, state.completedEventCount)));
        choices.append(option);
      }
    } else if (state.status === 'ended') {
      const ending = content.endings[state.endingId!]!;
      sceneTitle.textContent = `엔딩: ${ending.title}`; description.textContent = ending.description;
      button.textContent = '다시 태어나기';
    } else {
      sceneTitle.textContent = '출생 확인'; description.textContent = state.birthStory;
      button.textContent = '출생 생성 확인';
    }
    result.textContent = JSON.stringify({ ...birthPreview(content, state),
      currentEntity: entity.name, stage: stageNames[state.stage], completedEvents: state.completedEventCount,
      hiddenFate: state.hiddenFateRevealed ? destiny.name : '미공개',
    }, null, 2);
    history.replaceChildren();
    for (const entry of state.choiceHistory) {
      const item = document.createElement('li');
      const event = content.events[entry.eventId]!;
      const chosen = event.choices.find(choice => choice.id === entry.choiceId)!;
      item.textContent = `${event.title} → ${chosen.text}: ${entry.resultText}`;
      history.append(item);
    }
  }
  function act(action: () => unknown): void {
    try { action(); errorMessage.textContent = ''; render(); }
    catch (error) { errorMessage.textContent = (error as Error).message; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); act(() => session.roll(Number(input.value))); });
  start.addEventListener('click', () => act(() => session.start()));
  render();
}

main().catch(error => {
  app.textContent = `콘텐츠를 불러올 수 없습니다. ${(error as Error).message}`;
  app.setAttribute('role', 'alert');
});
