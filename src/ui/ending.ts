import type { GameState } from '../engine/game-state.ts';
import { birthFacts, button, el, fate, image, stats, timeline, title, type ViewContext } from './shared.ts';

export function endingView(context: ViewContext, state: GameState, rebirth: () => void, home: () => void): HTMLElement {
  const ending = context.content.endings[state.endingId!]!;
  const entity = context.content.entities[state.entityId]!;
  const view = el('section', 'ending-view');
  const hero = el('div', 'ending-hero');
  hero.append(el('p', 'ending-symbol', '∞'), title(ending.title, '열두 번의 선택, 하나의 삶'), el('p', 'ending-description', ending.description));
  const actions = el('div', 'ending-actions'); actions.append(button('다시 태어나기', rebirth), button('처음 화면', home, true)); hero.append(actions);
  const grid = el('div', 'ending-layout');
  const identity = el('section', 'portrait-card compact');
  identity.append(image(entity.image, entity.name, context.base, 'entity-art'), el('p', 'eyebrow', '마지막 모습'), el('h2', '', entity.name),
    el('p', 'hint', `${context.content.worlds[state.worldId]!.name}에서 태어나 12개의 선택을 남겼습니다.`),
    el('p', 'hint', `출생: ${context.content.entities[state.birthEntityId]!.name}`));
  grid.append(identity, stats(state, '삶이 남긴 능력'));
  const origins = el('details', 'history-disclosure'); origins.append(el('summary', '', '처음의 운명 돌아보기'), birthFacts(context, state), el('p', 'birth-story', state.birthStory));
  const story = el('section', 'life-timeline'); story.append(el('h2', '', '당신이 남긴 이야기'), el('p', 'hint', '한 번의 선택이 다음 장면으로, 그렇게 이어진 열두 순간.'), timeline(context, state));
  view.append(hero, grid, fate(context, state), origins, story); return view;
}
