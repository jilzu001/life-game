import type { GameState } from '../engine/game-state.ts';
import { birthFacts, button, el, fate, image, stats, title, type ViewContext } from './shared.ts';

export function birthView(context: ViewContext, state: GameState, reroll: () => void, begin: () => void): HTMLElement {
  const entity = context.content.entities[state.entityId]!;
  const view = el('section', 'birth-view'); view.append(title('당신에게 찾아온 삶', '탄생 · 아직은 모든 것이 가능하다'));
  const grid = el('div', 'birth-layout');
  const portrait = el('section', 'portrait-card');
  portrait.append(el('p', 'eyebrow', context.content.worlds[state.worldId]!.name), image(entity.image, entity.name, context.base, 'entity-art'),
    el('h2', '', entity.name), el('p', 'hint', entity.description), el('span', 'time-unit', `이 삶의 시간 · ${entity.timeUnit}`));
  const details = el('div', 'birth-details'); details.append(birthFacts(context, state), fate(context, state));
  grid.append(portrait, details);
  const story = el('blockquote', 'birth-story', state.birthStory);
  const bottom = el('div', 'birth-bottom');
  const actions = el('div', 'birth-actions');
  actions.append(el('p', 'hint', '이 운명을 받아들이겠습니까? 시작 전에는 얼마든지 다시 뽑을 수 있습니다.'),
    button('이 삶으로 시작하기', begin), button('다시 뽑기', reroll, true));
  bottom.append(stats(state, '타고난 능력'), actions);
  view.append(grid, story, bottom); return view;
}
