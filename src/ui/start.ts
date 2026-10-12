import type { GameState } from '../engine/game-state.ts';
import { button, el, image, title, type ViewContext } from './shared.ts';

export function startView(context: ViewContext, saved: GameState | null, generate: () => void, resume: () => void): HTMLElement {
  const view = el('section', 'start-view');
  const copy = el('div', 'start-copy');
  copy.append(title('이번 생에는\n무엇으로 태어날까?', '끝없이 다시 쓰는 삶, 무한생'));
  copy.append(el('p', 'intro', '누군가는 검으로, 누군가는 고양이나 작은 블랙홀로.\n태어남은 우연이지만, 그다음 이야기는 당신의 선택입니다.'));
  const actions = el('div', 'start-actions');
  if (saved) {
    const info = el('div', 'saved-life');
    info.append(el('span', 'eyebrow', saved.status === 'ended' ? '지난 생의 기록' : '당신을 기다리는 이야기'),
      el('strong', '', context.content.entities[saved.entityId]!.name),
      el('span', 'hint', `${context.content.worlds[saved.worldId]!.name} · ${saved.completedEventCount}/12개의 선택`));
    copy.append(info);
    actions.append(button(saved.status === 'ended' ? '지난 생 돌아보기' : '이어서 살아가기', resume));
  }
  if (!saved || saved.status === 'ended') actions.append(button('운명 생성', generate, !!saved));
  copy.append(actions, el('p', 'hint', '한 번의 삶, 12개의 선택 · 약 4~7분'));
  const art = el('div', 'start-art'); art.setAttribute('aria-hidden', 'true');
  art.append(el('div', 'orbit orbit-one'), el('div', 'orbit orbit-two'), el('span', 'infinity', '∞'));
  const entities = Object.values(context.content.entities).slice(0, 2);
  for (const [index, entity] of entities.entries()) {
    const card = el('div', `floating-entity floating-${index}`);
    card.append(image(entity.image, '', context.base), el('span', '', entity.name)); art.append(card);
  }
  art.append(el('p', 'art-caption', '어떤 모습이든, 한 번뿐인 이야기.'));
  view.append(copy, art);
  return view;
}
