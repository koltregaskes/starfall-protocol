import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputController } from '../src/game/input/InputController.ts';

test('controls recover from lost focus, aliases and disposal', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  document.hidden = false;
  const key = (type, code) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'code', { value: code });
    window.dispatchEvent(event);
  };
  const input = new InputController();
  try {
    key('keydown', 'KeyW');
    key('keydown', 'ArrowUp');
    key('keyup', 'KeyW');
    assert.equal(input.sample().moveY, 1, 'the second movement key is still held');
    key('keydown', 'ShiftLeft');
    key('keydown', 'ShiftRight');
    key('keyup', 'ShiftLeft');
    assert.equal(input.sample().sprint, true, 'the second Shift is still held');
    key('keydown', 'KeyE');
    key('keydown', 'KeyF');
    window.dispatchEvent(new Event('blur'));
    const idle = input.sample();
    assert.ok(Object.values(idle).every(value => value === false || value === 0));
    key('keydown', 'KeyE');
    assert.equal(input.sample().interactPressed, true, 'fresh input works after returning');
    assert.equal(input.sample().interactPressed, false, 'press is consumed once');
    key('keydown', 'KeyQ');
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.deepEqual(input.sample(), idle, 'hidden tabs release held and pending input');
    input.destroy();
    key('keydown', 'KeyW');
    assert.deepEqual(input.sample(), idle, 'destroy detaches listeners');
  } finally {
    input.destroy();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
