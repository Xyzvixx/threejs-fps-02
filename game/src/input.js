export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const pressed = new Set();
  const lookDelta = { x: 0, y: 0 };

  const state = {
    keys,
    locked: false,
    firing: false,
    lookX: 0,
    lookY: 0,
  };

  function clearKeys() {
    keys.clear();
    pressed.clear();
  }

  function requestLock() {
    if (typeof canvas.requestPointerLock === 'function') {
      canvas.requestPointerLock();
    }
  }

  function takeLook() {
    lookDelta.x = state.lookX;
    lookDelta.y = state.lookY;
    state.lookX = 0;
    state.lookY = 0;
    return lookDelta;
  }

  function consume(code) {
    if (!pressed.has(code)) return false;
    pressed.delete(code);
    return true;
  }

  function clearPressed() {
    pressed.clear();
  }

  function handleKeyDown(event) {
    if (event.code === 'Space') event.preventDefault();
    keys.add(event.code);
    if (!event.repeat) pressed.add(event.code);
  }

  function handleKeyUp(event) {
    keys.delete(event.code);
  }

  function handleMouseMove(event) {
    if (!state.locked) return;
    state.lookX += event.movementX || 0;
    state.lookY += event.movementY || 0;
  }

  function handleMouseDown(event) {
    if (event.button !== 0) return;
    const hasPointerLock = document.pointerLockElement === canvas;
    if (state.locked || hasPointerLock || window.__noLock === true) {
      state.firing = true;
    }
  }

  function handleMouseUp(event) {
    if (event.button === 0) state.firing = false;
  }

  function handlePointerLockChange() {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      clearKeys();
      state.firing = false;
    }
    if (typeof onLockChange === 'function') onLockChange(state.locked);
  }

  function handleBlur() {
    clearKeys();
    state.firing = false;
  }

  function handleContextMenu(event) {
    event.preventDefault();
  }

  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('contextmenu', handleContextMenu);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);

  return {
    state,
    requestLock,
    takeLook,
    consume,
    clearPressed,
  };
}
