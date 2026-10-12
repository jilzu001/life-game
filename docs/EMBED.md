# iframe 삽입

Phase 3에는 iframe 내부 플레이와 선택적인 높이 동기화를 구현했다. 아래 `https://jilzu001.github.io/life-game/`는 실제 배포 주소로 바꾼다. 현재 저장소와 배포 주소는 미설정이며 실제 티스토리 편집기·배포 환경 검증은 Phase 5에서 진행한다.

## 기본 삽입

```html
<iframe
  id="life-game"
  title="무한생 선택형 인생 게임"
  src="https://jilzu001.github.io/life-game/"
  width="100%"
  height="900"
  loading="lazy"
  style="display:block;width:100%;border:0"
></iframe>
```

부모 페이지의 스크립트 없이도 프레임 안에서 스크롤하며 플레이할 수 있다. 게임 페이지를 새 탭으로 여는 링크도 함께 제공하면 작은 화면에서 편리하다. 부모가 강제로 가로 폭을 고정하거나 `overflow:hidden`으로 전체 게임을 잘라내지 않도록 한다.

## 자동 높이 맞춤

부모 페이지에서 모듈 스크립트를 사용할 수 있다면 기본 iframe 뒤에 다음 코드를 추가한다.

```html
<script type="module">
  import { attachLifeFrame } from 'https://jilzu001.github.io/life-game/life-embed.js';
  const frame = document.getElementById('life-game');
  attachLifeFrame(frame);
</script>
```

게임은 `ResizeObserver`로 콘텐츠의 실제 높이를 측정한다. 부모 모듈은 해당 iframe의 window와 배포 origin이 일치하는 `life:resize` 버전 1 메시지만 반영한다. 높이는 1~20000의 정수만 허용하고 최소 320px로 표시한다. 스크립트가 제거되거나 실행되지 않으면 기본 900px 프레임 안에서 계속 플레이한다.

본문 편집기가 스크립트를 제거하는 환경에서는 기본 iframe을 사용하거나 해당 사이트가 허용하는 스킨·스크립트 삽입 위치를 사용해야 한다. 실제 편집기의 허용 여부는 아직 검증하지 않았다.

## 저장과 검증

- 게임 시작·선택·엔딩은 게임 origin의 localStorage에 저장한다. 같은 브라우저·origin에서 이어갈 수 있다.
- 브라우저의 iframe 저장 제한으로 접근·쓰기가 실패하면 화면 아래에 안내하고 현재 세션의 플레이는 계속한다. 저장 제한 시 새로고침 이후 복원은 보장하지 않는다.
- 숨겨진 운명·선택 기록·저장 데이터는 부모에게 전달하지 않는다. 부모로 보내는 데이터는 메시지 종류·버전·화면 높이뿐이다.
- 로컬 `/embed-example.html`의 체크박스로 고정 높이와 자동 높이를 비교할 수 있다. 선택 전환, 과거 기록 펼치기·접기, 긴 엔딩, 모바일 폭을 확인한다.
- 로컬 검증과 실제 티스토리·다른 브라우저의 저장 정책은 별개다. 외부 호스팅, 교차 origin, 실기기 검증 결과는 배포 단계에서 추가한다.
