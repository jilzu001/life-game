import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/engine/randomness.ts';

describe('시드 난수', () => {
  it('알려진 수열을 유지하여 알고리즘 변경을 감지한다', () => {
    const random = new SeededRandom(1);
    expect([random.next(), random.next(), random.next()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });
  it.each([0, 1, 42, 0xffffffff])('시드 %i의 수열을 재현하고 [0, 1) 범위를 유지한다', seed => {
    const first = new SeededRandom(seed);
    const second = new SeededRandom(seed);
    for (let i = 0; i < 1000; i++) {
      const value = first.next();
      expect(value).toBe(second.next());
      expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(1);
    }
  });
  it('JSON으로 왕복한 난수 상태에서 정확히 이어진다', () => {
    const random = new SeededRandom(291);
    for (let i = 0; i < 31; i++) random.next();
    const restored = SeededRandom.restore(JSON.parse(JSON.stringify(random.snapshot())));
    for (let i = 0; i < 50; i++) expect(restored.next()).toBe(random.next());
  });
  it.each([-1, 1.5, 0x100000000, NaN, Infinity])('잘못된 시드 %s를 거부한다', seed => {
    expect(() => new SeededRandom(seed)).toThrow('시드');
  });
  it('가중치 비율대로 추첨한다', () => {
    const random = new SeededRandom(42);
    let heavy = 0;
    for (let i = 0; i < 10000; i++) if (random.weighted([{ weight: 1, id: 'a' }, { weight: 3, id: 'b' }]).id === 'b') heavy++;
    expect(heavy).toBeGreaterThan(7300); expect(heavy).toBeLessThan(7700);
  });
  it('빈 목록과 잘못된 가중치를 거부한다', () => {
    const random = new SeededRandom(0);
    expect(() => random.weighted([])).toThrow();
    for (const weight of [0, -1, NaN, Infinity]) expect(() => random.weighted([{ weight }])).toThrow();
  });
});
