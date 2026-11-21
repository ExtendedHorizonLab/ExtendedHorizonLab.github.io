(() => {
  const mosaic = document.querySelector('.hero-mosaic');
  const panel = mosaic?.querySelector('.hero-news');
  const handle = panel?.querySelector('.hero-news-handle');
  if (!handle) return;

  let drag;

  function moveTo(x, y) {
    const maxX = Math.max(0, mosaic.clientWidth - panel.offsetWidth);
    const maxY = Math.max(0, mosaic.clientHeight - panel.offsetHeight);
    panel.classList.add('is-positioned');
    panel.style.left = Math.min(Math.max(0, x), maxX) + 'px';
    panel.style.top = Math.min(Math.max(0, y), maxY) + 'px';
  }

  function position() {
    const bounds = panel.getBoundingClientRect();
    const container = mosaic.getBoundingClientRect();
    return { x: bounds.left - container.left, y: bounds.top - container.top };
  }

  handle.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const { x, y } = position();
    drag = { id: event.pointerId, x: x - event.clientX, y: y - event.clientY };
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    moveTo(event.clientX + drag.x, event.clientY + drag.y);
  });

  handle.addEventListener('lostpointercapture', () => {
    drag = undefined;
  });

  handle.addEventListener('keydown', event => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const { x, y } = position();
    const step = event.shiftKey ? 40 : 12;
    moveTo(x + direction[0] * step, y + direction[1] * step);
  });

  const observer = new ResizeObserver(() => {
    if (panel.classList.contains('is-positioned')) {
      const { x, y } = position();
      moveTo(x, y);
    }
  });
  observer.observe(mosaic);
  observer.observe(panel);

  handle.hidden = false;
})();
