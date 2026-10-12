import type { GameState } from '../engine/game-state.ts';
import { availableChoices } from '../engine/events.ts';
import { button, el, fate, image, stageNames, stats, timeline, title, type ViewContext } from './shared.ts';

export function gameView(context: ViewContext, state: GameState, choose: (eventId: string, choiceId: string, count: number) => void): HTMLElement {
  const event = context.content.events[state.currentEventId!]!;
  const entity = context.content.entities[state.entityId]!;
  const view = el('section', 'game-view');
  const progress = el('div', 'life-progress');
  const label = el('p', 'progress-label'); label.append(el('span', '', `${stageNames[state.stage]} · ${entity.timeUnit}`), el('strong', '', `선택 ${state.completedEventCount + 1} / 12`));
  const meter = el('progress'); meter.max = 12; meter.value = state.completedEventCount; meter.setAttribute('aria-label', `완료한 선택 ${state.completedEventCount}개, 전체 12개`);
  progress.append(label, meter); view.append(progress);
  const grid = el('div', 'game-layout');
  const card = el('article', 'event-card');
  card.append(image(event.image, '', context.base, 'event-art'), title(event.title, `${context.content.worlds[state.worldId]!.name} · ${stageNames[state.stage]}`), el('p', 'event-description', event.description));
  const previous = state.choiceHistory.at(-1);
  if (previous) {
    const result = el('aside', 'previous-result'); result.append(el('span', 'eyebrow', '지난 선택의 흔적'), el('p', '', previous.resultText)); card.append(result);
  }
  const choices = el('div', 'choices'); choices.setAttribute('aria-label', '이번 사건의 선택');
  for (const [index, choice] of availableChoices(event, state).entries()) {
    const option = button('', () => choose(event.id, choice.id, state.completedEventCount), true);
    option.className = 'choice';
    const number = el('span', 'choice-number', String(index + 1).padStart(2, '0')); number.setAttribute('aria-hidden', 'true');
    const arrow = el('span', 'choice-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
    option.append(number, el('span', 'choice-text', choice.text), arrow); choices.append(option);
  }
  card.append(choices);
  const sidebar = el('aside', 'life-sidebar');
  const identity = el('div', 'current-identity');
  identity.append(image(entity.image, entity.name, context.base), el('p', 'eyebrow', '지금의 모습'), el('h2', '', entity.name));
  if (state.entityId !== state.birthEntityId) identity.append(el('p', 'hint', `${context.content.entities[state.birthEntityId]!.name}에서 이어진 삶`));
  sidebar.append(identity, stats(state), fate(context, state)); grid.append(card, sidebar); view.append(grid);
  if (state.choiceHistory.length) {
    const history = el('details', 'history-disclosure'); history.append(el('summary', '', `지나온 이야기 ${state.choiceHistory.length}`), timeline(context, state)); view.append(history);
  }
  return view;
}
