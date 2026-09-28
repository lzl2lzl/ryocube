const test = require('node:test');
const assert = require('node:assert/strict');
const PetHaptics = require('../docs/xhs/haptics.js');

function fixture(vibrate) {
  let time = 1000;
  const calls = [], page = { hidden: false };
  const haptics = new PetHaptics({
    device: { vibrate: vibrate || (duration => { calls.push(duration); return true; }) },
    page, now: () => time
  });
  return { haptics, calls, page, advance: ms => { time += ms; } };
}

test('petting feedback is off until explicitly enabled', () => {
  const { haptics, calls } = fixture();
  assert.equal(haptics.pulse(), false);
  assert.deepEqual(calls, []);
  haptics.setEnabled(true);
  assert.equal(haptics.pulse(), true);
  assert.deepEqual(calls, [12]);
});
test('rapid strokes are limited to short separated pulses without a queue', () => {
  const { haptics, calls, advance } = fixture();
  haptics.setEnabled(true);
  haptics.pulse();
  advance(159); haptics.pulse();
  assert.deepEqual(calls, [12]);
  advance(1); haptics.pulse();
  assert.deepEqual(calls, [12, 12]);
});
test('turning off cancels an active pulse and subsequent strokes stay silent', () => {
  const { haptics, calls, advance } = fixture();
  haptics.setEnabled(true); haptics.pulse();
  haptics.setEnabled(false);
  advance(200); haptics.pulse();
  assert.deepEqual(calls, [12, 0]);
});
test('hidden pages cannot vibrate and interrupting ends the current pulse', () => {
  const { haptics, calls, page, advance } = fixture();
  haptics.setEnabled(true); haptics.pulse();
  page.hidden = true; haptics.stop(); advance(200);
  assert.equal(haptics.pulse(), false);
  assert.deepEqual(calls, [12, 0]);
});
test('missing vibration support keeps the control unavailable', () => {
  const haptics = new PetHaptics({ device: {}, page: {}, now: () => 0 });
  assert.equal(haptics.supported, false);
  assert.equal(haptics.setEnabled(true), false);
  assert.equal(haptics.pulse(), false);
  assert.doesNotThrow(() => haptics.stop());
});
test('container denial or exceptions cannot interrupt petting', () => {
  for (const vibrate of [() => false, () => { throw Error('blocked'); }]) {
    const { haptics } = fixture(vibrate);
    haptics.setEnabled(true);
    assert.equal(haptics.pulse(), false);
    assert.doesNotThrow(() => haptics.stop());
  }
});
