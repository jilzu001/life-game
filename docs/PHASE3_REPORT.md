# 프로젝트 상태

기록일: 2026-10-13 (Asia/Seoul)

## 현재 완료 범위

**Phase 3 기본 UI 완료. Phase 4~5는 진행하지 않았다.**

프로젝트는 `life-game/`에 있다. 기존 게임과 상위 작업 공간 파일은 수정하지 않았다. Git 초기화·원격 저장소·실제 배포는 아직 하지 않았다. 이전 상세 기록은 `PHASE1_REPORT.md`, `PHASE2_REPORT.md`에 보존했다.

| 항목 | 상태 |
|---|---|
| Phase 1 기반·Phase 2 엔진 | 유지, 기존 85개 테스트 통과 |
| 시작 화면 | 소개, 운명 생성, 저장 이어하기·지난 생 보기 |
| 운명 생성 화면 | 출생 조건·설명·이미지·능력치, 제한 없는 다시 뽑기·확정 |
| 사건 화면 | 단계·진행률·서술·선택, 직전 결과·현재 존재·능력치·접는 기록 |
| 엔딩 화면 | 엔딩 서술·최종 존재·능력치·공개 운명·출생 조건·12개 선택 기록 |
| 모바일 UI | 800px·560px 분기, 세로 배치와 터치 버튼 |
| 접근성 | 네이티브 버튼, 제목 초점, 키보드 조작, 상태 알림, 능력치 레이블 |
| iframe | 기본 높이 내부 스크롤, 선택적 자동 높이와 부모 수신 모듈 |
| 개발 진단 화면 | 별도 diagnostics.html로 보존 |
| PC·모바일 폭·iframe 브라우저 검증 | 완료 |

## 현재 콘텐츠와 호환성

- 중세 판타지 1세계, 살아 있는 마검·인간 모험가 2존재
- 각 존재의 위치·특징·결함·숨겨진 운명 각각 2개
- 일반 사건 19 + 고갈 시 안전 사건 1 = 사건 20
- 엔딩 5, SVG 이미지 4
- **이번 콘텐츠 추가 0개**, 엔진·스키마·콘텐츠 변경 없음
- 앱 버전 `0.3.0`, 콘텐츠 버전 `0.2.0-phase2`, 스키마 버전 1
- Phase 2 저장을 정식 UI와 진단 화면에서 복원한다.
- 새 라이브러리를 추가하지 않고 TypeScript DOM·CSS와 브라우저 기본 기능을 사용했다.

## 이번 변경 파일

| 구분 | 파일 |
|---|---|
| 정식 UI 진입·스타일 | `src/main.ts`, `src/style.css`, `index.html` |
| 화면·공통 표시 | `src/ui/start.ts`, `birth.ts`, `game.ts`, `ending.ts`, `shared.ts` |
| iframe | `src/ui/embed.ts`, `public/life-embed.js`, `public/embed-example.html` |
| 보존한 진단 화면 | `diagnostics.html`, `src/diagnostics.ts`, `src/diagnostics.css` |
| 두 진입점 빌드 | `vite.config.ts` |
| 메시지 검증 테스트 | `tests/embed.test.js` |
| 버전 | `package.json`, `package-lock.json` |
| 문서 | `README.md`, `CHANGELOG.md`, `HANDOFF.md`, `src/ui/README.md`, `docs/EMBED.md`, `PROJECT_STATE.md`, `PHASE2_REPORT.md` |
| 검증 증거 | `docs/qa/phase3-start-desktop.jpg`, `phase3-game-mobile.jpg`, `phase3-ending-desktop.jpg`, `phase3-iframe-mobile.jpg` |

## 검증 결과

- `npm run validate:content`: 통과. 256회 모두 사건 12개와 엔딩까지 도달, 정상 경로의 안전 사건 사용 0회.
- `npm run test`: **6개 파일, 95개 테스트 통과**. 기존 85개 + 부모 메시지 출처·버전·범위 검사 10개.
- `npm run build`: TypeScript 검사·Vite 프로덕션 빌드 통과. 정식 UI와 진단 화면 모두 출력.
- 프로덕션 preview에서 실제 UI 버튼으로 운명 생성 → 다시 뽑기 → 출생 확정 → 12개 선택 → **‘약속으로 남은 전설’** 엔딩을 확인했다.
- 선택 1개 이후 새로고침·이어하기로 같은 사건과 진행률을 복원했다. 엔딩 이후 새로고침·지난 생 보기로 최종 상태와 12개 기록을 복원했다.
- PC 1280×900 및 모바일 폭 320·390에서 확인했다. 320px 화면의 문서 폭·콘텐츠 폭은 모두 305px(스크롤바 제외), 선택 버튼 높이는 최소 60px였다.
- 부모 높이 수신 코드가 없는 900px iframe에서 이어하기와 선택을 진행했다.
- 자동 높이 모드에서 사건 화면 1111px → 기록 펼침 1404px → 접힘 1111px로 늘고 줄었다.
- PC iframe 엔딩의 실제 높이 3070.328125px를 3071px로 반영했다. 모바일 iframe은 내부 폭·콘텐츠 폭 모두 351px, 실제 높이 3542.578125px를 3543px로 반영했다.
- iframe에서 화면 전환 후 새 제목으로 초점과 부모 스크롤이 이동하는 것을 확인했다.
- `diagnostics.html`에서도 같은 엔딩 저장, 시드, JSON, 12개 기록을 확인했다.
- 단독 게임 탭 콘솔 오류·경고는 없었다. iframe 탭에서는 Codex 인앱 브라우저의 Electron preload 스크립트에서 `MutationObserver.observe` 오류가 기록됐다. 스택과 스크립트 원문으로 게임 번들이 아닌 위치임을 확인했다. 게임 진행·높이 동기화는 정상 동작했다.

## 알려진 제한과 다음 작업

- 현재 실제 콘텐츠는 1세계·2존재다. Phase 4의 6세계·30존재·180사건·30엔딩은 미제작이다.
- 실제 GitHub Pages·티스토리, 교차 origin iframe 저장 제한, 모바일 실기기·다른 브라우저는 미검증이다. 로컬 모바일 폭 검증은 실기기 검증을 대신하지 않는다.
- iframe 저장 제한 시 안내하고 현재 세션 플레이를 유지하지만, 저장하지 못하면 새로고침 이후 복원은 보장하지 않는다.
- 외부 배포 주소가 아직 없으므로 `EMBED.md`에는 교체할 주소 예시만 제공한다.
- 기존 출생 서술에 ‘인간 모험가으로’ 같은 조사 표현이 남아 있다. 콘텐츠·출생 문장 다듬기는 후속 단계에서 저장 재현 영향과 함께 검토한다.
- 콘텐츠를 바꿀 때 저장 재현에 영향을 주면 콘텐츠 버전을 갱신한다. 엔진 규칙은 `ENGINE.md`, 작성 규격은 `CONTENT_FORMAT.md`를 따른다.
- **다음 단계는 Phase 4 MVP 콘텐츠 제작이며, 명시적인 후속 지시 후 진행한다.**
