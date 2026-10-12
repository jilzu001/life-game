import type { Content, Stage } from '../content/schema.ts';
import type { GameState } from '../engine/game-state.ts';
import { contentUrl } from '../content/loader.ts';

export const stageNames: Record<Stage, string> = { birth: '탄생', awakening: '각성', growth: '성장', crisis: '위기', transition: '전환', climax: '절정', conclusion: '결말' };
export interface ViewContext { content: Content; base: URL }
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
export function button(text: string, action: () => void, secondary = false): HTMLButtonElement {
  const node = el('button', secondary ? 'button button-secondary' : 'button button-primary', text);
  node.type = 'button'; node.addEventListener('click', action); return node;
}
export function title(text: string, eyebrow: string): HTMLElement {
  const group = el('header', 'section-heading');
  const heading = el('h1', '', text); heading.tabIndex = -1; heading.dataset.screenTitle = '';
  group.append(el('p', 'eyebrow', eyebrow), heading); return group;
}
export function image(path: string, alt: string, base: URL, className = ''): HTMLImageElement {
  const node = el('img', className); node.alt = alt; node.width = 240; node.height = 160;
  node.src = contentUrl(path, base).href;
  node.addEventListener('error', () => {
    if (node.dataset.fallback) { node.hidden = true; return; }
    node.dataset.fallback = 'true'; node.src = contentUrl('images/fallback.svg', base).href;
  });
  return node;
}
export function icon(kind: 'spark' | 'survival' | 'influence' | 'intelligence' | 'freedom' | 'chaos'): SVGSVGElement {
  const paths = {
    spark: 'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z',
    survival: 'M12 3 20 6V12Q20 18 12 22Q4 18 4 12V6Z',
    influence: 'M3 7 7 11 12 4 17 11 21 7 19 19H5Z',
    intelligence: 'M4 5Q8 3 12 6Q16 3 20 5V20Q16 18 12 21Q8 18 4 20ZM12 6V21',
    freedom: 'M3 16 12 7 21 16M12 7V22M5 3H19',
    chaos: 'M13 2 4 14H11L10 22 21 9H13Z',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'icon');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[kind]); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.5'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path); return svg;
}
export function stats(state: GameState, caption = '지금의 나'): HTMLElement {
  const panel = el('section', 'stats-panel'); panel.setAttribute('aria-label', caption);
  panel.append(el('h2', 'panel-title', caption));
  const labels = { survival: '생존력', influence: '영향력', intelligence: '지능', freedom: '자유도', chaos: '혼돈도' } as const;
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    const row = el('div', `stat-row stat-${key}`);
    const label = el('span', 'stat-label'); label.append(icon(key), document.createTextNode(labels[key]));
    const value = el('span', 'stat-value', String(state.stats[key]));
    const meter = el('div', 'stat-track'); meter.setAttribute('role', 'meter');
    meter.setAttribute('aria-label', labels[key]); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100'); meter.setAttribute('aria-valuenow', String(state.stats[key]));
    const fill = el('span', 'stat-fill'); fill.style.width = `${state.stats[key]}%`; meter.append(fill);
    row.append(label, value, meter); panel.append(row);
  }
  panel.append(el('p', 'hint chaos-hint', '혼돈이 높아질수록 뜻밖의 기회와 위험을 만납니다.'));
  return panel;
}
export function birthFacts(context: ViewContext, state: GameState): HTMLElement {
  const origin = context.content.entities[state.birthEntityId]!;
  const rows = [
    ['태어난 곳', origin.birthLocations.find(option => option.id === state.birthLocationId)!],
    ['타고난 특징', origin.traits.find(option => option.id === state.traitId)!],
    ['치명적인 결함', origin.flaws.find(option => option.id === state.flawId)!],
  ] as const;
  const list = el('dl', 'birth-facts');
  for (const [label, option] of rows) {
    const row = el('div', 'fact'); row.append(el('dt', '', label));
    const detail = el('dd'); detail.append(el('strong', '', option.name), el('p', 'hint', option.description)); row.append(detail); list.append(row);
  }
  return list;
}
export function fate(context: ViewContext, state: GameState): HTMLElement {
  const panel = el('aside', state.hiddenFateRevealed ? 'fate revealed' : 'fate');
  panel.append(icon('spark'));
  const copy = el('div');
  if (state.hiddenFateRevealed) {
    const destiny = context.content.entities[state.birthEntityId]!.hiddenFates.find(option => option.id === state.hiddenFateId)!;
    copy.append(el('p', 'eyebrow', '드러난 운명'), el('strong', '', destiny.name), el('p', 'hint', destiny.description));
  } else copy.append(el('strong', '', '아직 펼쳐지지 않은 운명'), el('p', 'hint', '당신의 이야기가 흐르는 어느 순간, 그 비밀이 드러납니다.'));
  panel.append(copy); return panel;
}
export function timeline(context: ViewContext, state: GameState): HTMLOListElement {
  const list = el('ol', 'timeline');
  for (const [index, entry] of state.choiceHistory.entries()) {
    const event = context.content.events[entry.eventId]!;
    const choice = event.choices.find(candidate => candidate.id === entry.choiceId)!;
    const item = el('li');
    item.append(el('span', 'timeline-number', String(index + 1).padStart(2, '0')));
    const copy = el('div');
    copy.append(el('p', 'eyebrow', `${stageNames[entry.stage]} · ${context.content.entities[entry.entityId]!.name}`),
      el('h3', '', event.title), el('p', 'chosen', choice.text), el('p', 'hint', entry.resultText));
    item.append(copy); list.append(item);
  }
  return list;
}
