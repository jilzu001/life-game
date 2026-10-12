# 무한생 (LIFE)

여러 세계에서 다양한 존재로 태어나는 선택형 인생 게임. 6세계·30존재·일반 사건 185개·엔딩 30개를 갖추었으며 시작 → 운명 생성 → 사건 → 엔딩의 네 화면에서 12개 선택으로 한 생을 완주한다.

[게임 실행](https://jilzu001.github.io/life-game/) · [GitHub 저장소](https://github.com/jilzu001/life-game)

배포 절차는 `docs/DEPLOYMENT.md`, 실제 검증 결과와 남은 항목은 `docs/PROJECT_STATE.md`에 기록한다.

## 실행

Node.js 24 이상에서 이 폴더를 작업 경로로 사용한다.

```sh
npm ci
npm run dev
```

터미널에 표시된 로컬 주소를 열면 시작 화면이 나온다. `운명 생성`으로 태어날 존재를 뽑고, 마음에 들면 `이 삶으로 시작하기`를 누른다. 확정 전에는 제한 없이 다시 뽑을 수 있다. 시작·선택·엔딩에서 자동 저장하며 새로고침 후 시작 화면의 이어하기로 복원한다. 완료한 인생은 `지난 생 돌아보기`에서 확인한다.

기존 시드 입력·진단 JSON 화면은 `/diagnostics.html`에 보존했다. `/embed-example.html`에서는 기본 높이 iframe과 자동 높이 모드를 비교할 수 있다. 삽입 예시는 `docs/EMBED.md`를 참고한다.

```sh
npm run validate:content
npm run test
npm run build
npm run preview
```

빌드 결과는 `dist/`에 생성된다. 기본 `base: './'`로 하위 배포 경로를 지원한다. `npm run verify`로 콘텐츠·테스트·빌드·배포 파일 검사를 한 번에 실행한다. GitHub Actions는 검증을 통과한 `main`만 Pages에 게시한다. 배포 검사는 기본 상대 경로를 기준으로 루트와 `/life-game/` 주소를 모두 검사한다.

## 주요 파일

| 영역 | 파일 |
|---|---|
| 개발 규칙 | `AGENTS.md` |
| 원본 지시서 | `docs/DEVELOPMENT_SPEC.md` |
| 작업 상태와 다음 단계 | `docs/PROJECT_STATE.md` |
| 콘텐츠 작성 규격 | `docs/CONTENT_FORMAT.md` |
| 세계별 목록·30종 재현 시드 | `docs/CONTENT_CATALOG.md` |
| 스키마와 타입 원본 | `src/content/schema.ts` |
| 배포 콘텐츠 로더 | `src/content/loader.ts` |
| 참조·출생 도달성 검사 | `src/content/validator.ts` |
| 게임 상태 | `src/engine/game-state.ts` |
| 난수·출생 | `src/engine/randomness.ts`, `src/engine/birth.ts` |
| 사건·분기·효과·엔딩 | `src/engine/conditions.ts`, `effects.ts`, `events.ts`, `branching.ts`, `endings.ts`, `game.ts` |
| 저장·세션 | `src/engine/save.ts`, `session.ts` |
| 정식 UI | `src/main.ts`, `src/style.css`, `src/ui/` |
| iframe 연결 | `src/ui/embed.ts`, `public/life-embed.js`, `docs/EMBED.md` |
| 엔진 규칙 | `docs/ENGINE.md` |
| 생성된 JSON Schema | `schemas/*.schema.json` |
| MVP 데이터 | `public/content/manifest.json`, `worlds/`, `entities/`, `events/`, `endings/` |
| 검증과 테스트 | `scripts/`, `tests/` |

현재 콘텐츠는 중세 판타지·좀비 아포칼립스·사이버펑크·우주 SF·현대 헌터물·현실 세계다. 세계별 존재 5종과 엔딩 5개가 있으며, 사건은 공통 77개·전용 90개·범용 돌발 18개와 별도 안전 사건 6개로 구성된다. 기존 판타지 사건을 보존해 일반 사건 수가 최소 목표 180개보다 5개 많다.

`validate:content`는 세계별 고정 시드 4,096개 × 선택 전략 4개로 총 98,304회 완주와 콘텐츠 도달성을 검사한다. `npm run validate:content -- --report`로 결과를 `docs/qa/phase4-simulation.json`에 저장할 수 있다. Phase 1·2 당시 데이터는 `tests/fixtures/`에 보존하고 최신 전체 콘텐츠는 `tests/mvp.test.ts`에서 별도로 검사한다.

콘텐츠 버전은 `0.4.0-mvp`다. 이전 `0.2.0-phase2` 저장은 추첨 풀이 달라져 이어갈 수 없으며 화면에서 새 인생 시작을 안내한다. 이전 저장은 자동 삭제하지 않고 새 인생을 확정할 때 교체한다.

엔진은 JSON에서 검증된 데이터만 받는다. 런타임 검증에는 Zod를 사용하며, 같은 정의에서 타입과 JSON Schema를 생성한다. 추가 프레임워크나 데이터베이스는 사용하지 않는다.
