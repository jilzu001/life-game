# 프로젝트 상태

기록일: 2026-10-12 (Asia/Seoul)

## 현재 완료 범위

**Phase 1 완료. Phase 2~5는 진행하지 않았다.**

기존 작업 공간의 README에서 게임별 별도 폴더 사용 규칙을 확인했다. 무한생 기존 코드는 없었으므로 `life-game/`에 새 프로젝트를 구성했다. 작업 공간 루트는 Git 저장소가 아니며 이 프로젝트의 Git 초기화·원격 저장소·배포 설정은 아직 하지 않았다. 기존 게임 폴더와 상위 파일은 수정하지 않았다.

| 항목 | 상태 |
|---|---|
| TypeScript·Vite·Vitest 초기화 | 완료 |
| 작업 규칙·원본 명세·진행 기록 | 완료 |
| 콘텐츠 규격·엄격한 런타임 검증·JSON Schema 6종 | 완료 |
| manifest 기준 JSON 로딩 | 완료 |
| 게임 상태 모델 | 완료 |
| 재현 가능한 시드 난수와 상태 복원 | 완료 |
| 가중치 출생, 조건 필터, 출생 효과, 이야기 생성 | 완료 |
| 숨겨진 운명 지정과 공개 정보 분리 | 완료 |
| 샘플 로딩·출생 생성의 브라우저 확인 | 완료 |

## 콘텐츠 수량

- 세계관 1: 중세 판타지
- 존재 1: 살아 있는 마검
- 위치 2, 특징 2, 결함 2, 숨겨진 운명 2
- 모순을 제거한 유효 출생 조합 6
- 사건 0, 엔딩 0
- SVG 3: 세계관, 마검, 대체 이미지

MVP 목표 6세계·30존재·180사건·30엔딩은 아직 완료하지 않았다.

## 변경 파일

모든 추가·수정은 `life-game/` 내부다.

| 영역 | 파일 |
|---|---|
| 설정 | `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html` |
| 규칙·문서 | `AGENTS.md`, `README.md`, `CHANGELOG.md`, `HANDOFF.md`, `docs/DEVELOPMENT_SPEC.md`, `docs/CONTENT_FORMAT.md`, `docs/PROJECT_STATE.md` |
| 콘텐츠 기반 | `src/content/schema.ts`, `loader.ts`, `validator.ts` |
| 엔진 기반 | `src/engine/game-state.ts`, `randomness.ts`, `birth.ts` |
| 개발 확인 화면 | `src/main.ts`, `src/style.css`, `src/ui/README.md` |
| 데이터 | `public/content/manifest.json`, `worlds/fantasy.json`, `entities/fantasy_sword.json`, `events/.gitkeep`, `endings/.gitkeep` |
| 이미지 | `public/content/images/worlds/fantasy.svg`, `entities/magic-sword.svg`, `fallback.svg` |
| 생성 규격 | `schemas/manifest.schema.json`, `world.schema.json`, `entity.schema.json`, `event.schema.json`, `ending.schema.json`, `game-state.schema.json` |
| 스크립트 | `scripts/generate-schema.mjs`, `scripts/validate-content.mjs` |
| 테스트 | `tests/fixtures.ts`, `randomness.test.ts`, `birth.test.ts`, `content.test.ts` |
| 검증 화면 | `docs/qa/phase1-browser.jpg` |

`node_modules/`와 `dist/`는 로컬 설치·빌드 결과이며 `.gitignore`에 등록했다.

## 검증 결과

- `npm run validate:content`: 통과. JSON·엄격한 스키마·생성 스키마 동기화·중복·참조·출생 조건 도달성·이미지 존재와 SVG 제한 검사.
- `npm run test`: **3개 파일, 51개 테스트 통과**.
- `npm run build`: TypeScript 검사와 Vite 프로덕션 빌드 통과.
- 고정 시드 256개에서 유효 출생 조합 6개 모두 관측, 금지 조합 0개.
- 고정 시드 1,000개로 조건 필터가 특징 가중치를 왜곡하지 않는지 확인.
- 난수 알려진 수열·난수 상태 JSON 왕복·상태 독립성·능력치 범위 확인.
- 테스트용 추가 세계관·존재를 manifest와 데이터만으로 로딩·추첨하는 확장성 확인.
- 루트·프로젝트·중첩 경로의 URL 해석과 하위 경로 HTTP 로더 확인.
- 실제 브라우저에서 빌드 결과를 열어 JSON 로딩, 시드 42 → 1 → 42 재현, 마검 SVG 로딩, 숨겨진 운명 미공개를 확인. 콘솔 오류·경고 없음.
- 최종 빌드 후 브라우저를 새로고침하고 결과 및 이미지 로딩을 다시 확인했다. 화면은 `docs/qa/phase1-browser.jpg`에 보관.

검증 도중 발생했던 타입 추론 오류와 테스트 괄호 오타는 원인을 확인하고 각각 수정했다. 최종 실패 항목은 없다. 자세한 기록은 `HANDOFF.md`에 있다.

## 결정 사항과 다음 작업 주의사항

- 원본 전체 경로가 영문이므로 임시 복사 빌드 우회를 사용하지 않았다.
- 검증 라이브러리는 Zod 하나를 사용한다. Vite·TypeScript·Vitest와 Node 타입은 개발 의존성이다. 잠금 파일을 유지한다.
- Node.js 24 이상이 필요하다. Node의 기본 TypeScript 실행으로 검증 스크립트를 구동하며 별도 실행 라이브러리를 추가하지 않았다.
- 출생 추첨에 필요한 조건·효과만 구현했다. 사건 실행기 역할의 빈 파일이나 임시 함수는 만들지 않았다.
- 사건·엔딩 규격은 정의했지만 분기 실행·조건 이력 판정·변신·엔딩 선택 기능은 미구현이다.
- `gameStateSchema`는 상태의 구조를 정의한다. Phase 2에서 저장 로딩 시 상태별 필수 값, 현재 콘텐츠 ID, 버전 호환을 추가 검증해야 한다.
- 출생 상태를 반환할 뿐 localStorage 저장·출생 확정·게임 시작 후 재추첨 차단은 구현하지 않았다.
- 샘플 확인 화면을 정식 게임 UI로 간주하지 않는다. Phase 3에서 화면을 구현한다.
- 실제 GitHub Pages 배포, 티스토리 iframe, 모바일 게임 UI, 사건 12회 진행, 저장 복구, 전체 출생 유형 엔딩 도달은 미구현 또는 미검증이다.
- Phase 2 진행은 사용자의 명시적인 후속 지시를 받은 뒤 시작한다. 다음 범위는 사건 조건·효과·추첨·분기·변신·엔딩·저장과 샘플 1회 완주다.
