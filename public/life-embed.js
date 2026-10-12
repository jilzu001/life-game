/** 지정한 iframe에서 온 높이 메시지만 허용한다. 게임 저장 데이터는 다루지 않는다. */
export function frameHeight(event, source, origin) {
  if (!source || event.source !== source || event.origin !== origin) return null;
  const data = event.data;
  if (!data || typeof data !== 'object' || data.type !== 'life:resize' || data.version !== 1
    || !Number.isInteger(data.height) || data.height < 1 || data.height > 20000) return null;
  return Math.max(320, data.height);
}

export function attachLifeFrame(frame, onResize = () => {}) {
  const origin = new URL(frame.src, document.baseURI).origin;
  const measure = () => frame.contentWindow?.postMessage({ type: 'life:measure', version: 1 }, origin);
  const receive = event => {
    const height = frameHeight(event, frame.contentWindow, origin);
    if (height === null) return;
    frame.style.height = `${height}px`;
    onResize(height);
  };
  window.addEventListener('message', receive);
  frame.addEventListener('load', measure);
  measure();
  return () => { window.removeEventListener('message', receive); frame.removeEventListener('load', measure); };
}
