/**
 * 编辑历史 — 撤销 / 重做（项目快照）
 */
const EditHistory = (() => {
  const MAX = 48;
  let stack = [];
  let index = -1;
  let getState = null;
  let applyState = null;
  let onChange = null;
  let applying = false;

  function serialize(state) {
    return JSON.stringify(state);
  }

  function notify() {
    if (typeof onChange === "function") onChange(canUndo(), canRedo());
  }

  function canUndo() {
    return index > 0;
  }

  function canRedo() {
    return index >= 0 && index < stack.length - 1;
  }

  function reset(state) {
    stack = [serialize(state)];
    index = 0;
    notify();
  }

  function record(state) {
    if (applying) return;
    const snap = serialize(state);
    if (index >= 0 && stack[index] === snap) return;
    stack = stack.slice(0, index + 1);
    stack.push(snap);
    if (stack.length > MAX) {
      stack.shift();
    }
    index = stack.length - 1;
    notify();
  }

  function undo() {
    if (!canUndo() || !applyState) return false;
    applying = true;
    index -= 1;
    try {
      applyState(JSON.parse(stack[index]));
    } finally {
      applying = false;
    }
    notify();
    return true;
  }

  function redo() {
    if (!canRedo() || !applyState) return false;
    applying = true;
    index += 1;
    try {
      applyState(JSON.parse(stack[index]));
    } finally {
      applying = false;
    }
    notify();
    return true;
  }

  function isApplying() {
    return applying;
  }

  function init(options) {
    getState = options.getState;
    applyState = options.applyState;
    onChange = options.onChange || null;
    if (getState) reset(getState());
  }

  function capture() {
    if (getState) record(getState());
  }

  return {
    init,
    reset,
    record,
    capture,
    undo,
    redo,
    canUndo,
    canRedo,
    isApplying,
  };
})();
