import { describe, expect, it } from 'vitest';
import { frameHeight } from '../public/life-embed.js';

describe('iframe 높이 메시지', () => {
  const source = {};
  const origin = 'https://example.com';
  const event = height => ({ source, origin, data: { type: 'life:resize', version: 1, height } });
  it('등록한 프레임의 높이를 읽고 작은 화면은 최소 높이를 보장한다', () => {
    expect(frameHeight(event(1250), source, origin)).toBe(1250);
    expect(frameHeight(event(100), source, origin)).toBe(320);
  });
  it('다른 창이나 출처의 메시지를 무시한다', () => {
    expect(frameHeight(event(900), {}, origin)).toBeNull();
    expect(frameHeight(event(900), source, 'https://other.com')).toBeNull();
    expect(frameHeight(event(900), null, origin)).toBeNull();
  });
  it.each([NaN, Infinity, -1, 0, 1.5, 20001, '900'])('잘못된 높이 %s를 무시한다', height => {
    expect(frameHeight(event(height), source, origin)).toBeNull();
  });
  it('게임 데이터나 알 수 없는 형식을 높이 메시지로 처리하지 않는다', () => {
    for (const data of [null, {}, { type: 'life:save', version: 1, height: 900 }, { type: 'life:resize', version: 2, height: 900 }]) {
      expect(frameHeight({ source, origin, data }, source, origin)).toBeNull();
    }
  });
});
