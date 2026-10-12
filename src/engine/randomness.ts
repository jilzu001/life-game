export interface RandomSnapshot { algorithm: 'mulberry32-v1'; state: number }

function assertUint32(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error('시드는 0~4294967295 범위의 정수여야 합니다.');
  }
}

/** Mulberry32: 저장 가능한 32비트 상태를 가진 결정적 난수 생성기. 보안 용도가 아니다. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    assertUint32(seed);
    this.state = seed;
  }

  static restore(snapshot: RandomSnapshot): SeededRandom {
    if (snapshot.algorithm !== 'mulberry32-v1') throw new Error('지원하지 않는 난수 알고리즘입니다.');
    return new SeededRandom(snapshot.state);
  }

  snapshot(): RandomSnapshot { return { algorithm: 'mulberry32-v1', state: this.state }; }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  weighted<T extends { weight: number }>(entries: readonly T[]): T {
    if (!entries.length) throw new Error('추첨 가능한 항목이 없습니다.');
    let total = 0;
    for (const entry of entries) {
      if (!Number.isFinite(entry.weight) || entry.weight <= 0) throw new Error('가중치는 유한한 양수여야 합니다.');
      total += entry.weight;
    }
    if (!Number.isFinite(total)) throw new Error('가중치 합계가 너무 큽니다.');
    let ticket = this.next() * total;
    for (const entry of entries) {
      ticket -= entry.weight;
      if (ticket < 0) return entry;
    }
    return entries[entries.length - 1]!;
  }
}
