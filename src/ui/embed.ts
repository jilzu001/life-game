/** 부모에는 화면 높이만 전달한다. 게임 상태와 저장 데이터는 보내지 않는다. */
export function syncEmbedHeight(root: HTMLElement): () => void {
  if (window.parent === window) return () => {};
  let targetOrigin = '*';
  try {
    const referrer = new URL(document.referrer);
    if (['http:', 'https:'].includes(referrer.protocol)) targetOrigin = referrer.origin;
  } catch { /* referrer가 없는 임베드에서도 높이 통지는 가능하다. */ }
  let lastHeight = 0;
  let frame = 0;
  const notify = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // viewport 높이를 읽으면 부모와 자식 사이에서 높이가 계속 증가할 수 있다.
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (height < 1 || height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage({ type: 'life:resize', version: 1, height }, targetOrigin);
    });
  };
  const observer = new ResizeObserver(notify); observer.observe(root);
  const measure = (event: MessageEvent) => {
    if (event.source !== window.parent || (targetOrigin !== '*' && event.origin !== targetOrigin)) return;
    if (event.data?.type !== 'life:measure' || event.data?.version !== 1) return;
    lastHeight = 0; notify();
  };
  window.addEventListener('message', measure);
  window.addEventListener('resize', notify); notify();
  return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', notify); window.removeEventListener('message', measure); };
}
