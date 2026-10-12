# GitHub Pages 배포

## 주소와 범위

- 저장소: https://github.com/jilzu001/life-game
- 게임 주소: https://jilzu001.github.io/life-game/
- 진단 화면: https://jilzu001.github.io/life-game/diagnostics.html
- iframe 예제: https://jilzu001.github.io/life-game/embed-example.html

저장소 루트는 이 프로젝트 `life-game/`의 내용이다. 상위 작업 공간이나 다른 게임을 포함하지 않는다. GitHub 게시 후 후속 요청으로 `public/blog.html`에 티스토리 복붙용 본문을 추가했다. 실제 티스토리 게시·글 삽입 검증은 하지 않았다. `docs/TISTORY.md`를 참고한다.

## 자동 배포

저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정한다. `.github/workflows/pages.yml`이 `main` 푸시와 수동 실행을 처리한다.

1. Ubuntu에서 Node.js 24와 `npm ci`로 잠금 파일의 의존성을 설치한다.
2. `npm run verify`로 콘텐츠 정합성·98,304회 시뮬레이션·회귀 테스트·타입 검사·Vite 빌드·배포 파일 검사를 수행한다.
3. 전부 성공하면 `dist/`만 Pages artifact에 올린다.
4. 배포 작업이 성공한 artifact를 GitHub Pages에 게시한다.

PR은 동일한 검증만 실행하며 게시하지 않는다. 검증 실패 시 `needs: build`로 배포를 차단한다. `pages: write`, `id-token: write` 권한은 배포 작업에만 부여한다. 개인 토큰을 Actions secret에 저장하지 않는다.

기본 상대 경로 `./`를 유지한다. 배포 검사기는 HTML·청크·콘텐츠·이미지 참조와 파일명 대소문자, public 원본과 dist 복사본의 바이트 일치를 검사한다. 브라우저의 실제 렌더링을 대체하는 검사는 아니다.

## 로컬 검증과 갱신

```sh
npm ci
npm run verify
npm run validate:dist -- --report
git add .
git commit -m "무한생 콘텐츠 및 기능 갱신"
git push origin main
```

`docs/qa/phase5-dist.json`은 검증 당시 배포 파일별 SHA-256이다. 게임 데이터가 바뀌면 콘텐츠 버전과 저장 호환성을 먼저 검토한다. 앱 버전과 콘텐츠 버전은 별개다. 이번 배포는 앱 0.5.0, 콘텐츠 0.4.0-mvp, 스키마 1을 사용한다.

## 게시 후 확인

- Actions의 검증 및 배포 작업이 모두 성공했는지 확인한다.
- 게임 HTML·모든 JSON·이미지·JS·CSS가 공개 주소에서 HTTP 200으로 제공되고 로컬 배포 파일과 일치하는지 확인한다.
- PC와 모바일에서 운명 생성 → 다시 뽑기 → 출생 확정 → 12개 선택 → 엔딩을 확인한다.
- 진행 중 새로고침 후 이어하기와 엔딩 후 지난 생 복원을 확인한다.
- 화면 가로 넘침, 깨진 이미지, 콘솔 오류를 확인한다.
- 실제 휴대전화 확인은 에뮬레이션과 별도다. 티스토리 검증은 이후 요청 시 진행한다.

문제가 있는 배포는 GitHub의 이전 성공 실행을 재실행하거나 원인 커밋을 되돌리는 새 커밋을 푸시한다. 원격 이력을 강제로 덮어쓰지 않는다. 콘텐츠 버전이 달라진 저장은 이전 버전과 호환되지 않을 수 있으므로 안내를 유지한다.

## 참고한 공식 문서

- [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Vite의 GitHub Pages 배포](https://vite.dev/guide/static-deploy.html#github-pages)
- [Node 설정 Action](https://github.com/actions/setup-node)
