const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { TapSequence, PetStroke } = require('../docs/xhs/gestures.js');

test('classic script exposes the same independent gesture constructors', () => {
  const context = { self: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../docs/xhs/gestures.js'), 'utf8'), context);
  assert.equal(typeof context.self.CubeGestures.TapSequence, 'function');
  assert.equal(typeof context.self.CubeGestures.PetStroke, 'function');
});

test('nine rapid awake taps transform and the next nine form a fresh burst', () => {
  const taps = new TapSequence();
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 9; i++) {
      assert.deepEqual(taps.push((round * 9 + i) * 120, false), {
        kind: i === 8 ? 'transform' : 'tap', rapidCount: i + 1
      });
    }
  }
});

test('450ms gaps are allowed but greater gaps begin another burst', () => {
  const taps = new TapSequence();
  assert.equal(taps.push(0, false).rapidCount, 1);
  assert.equal(taps.push(450, false).rapidCount, 2);
  assert.equal(taps.push(901, false).rapidCount, 1);
});

test('nine taps taking more than three seconds do not transform', () => {
  const taps = new TapSequence();
  for (let i = 0; i < 20; i++) assert.equal(taps.push(i * 400, false).kind, 'tap');
  assert.equal(taps.push(7700, false).kind, 'transform');
});

test('exactly three seconds is a valid nine-tap burst', () => {
  const taps = new TapSequence();
  for (let i = 0; i < 8; i++) assert.equal(taps.push(i * 375, false).kind, 'tap');
  assert.equal(taps.push(3000, false).kind, 'transform');
});

test('the whole sleeping burst is for waking and its awake tail is ignored', () => {
  const taps = new TapSequence();
  for (let i = 0; i < 5; i++) assert.deepEqual(taps.push(i * 100, true), { kind: 'wake', rapidCount: 0 });
  for (let i = 5; i < 18; i++) assert.deepEqual(taps.push(i * 100, false), { kind: 'wake-tail', rapidCount: 0 });
  assert.deepEqual(taps.push(2150, false), { kind: 'wake-tail', rapidCount: 0 });
  assert.deepEqual(taps.push(2601, false), { kind: 'tap', rapidCount: 1 });
});

test('reset discards both partial taps and waking tails', () => {
  const taps = new TapSequence();
  taps.push(0, false); taps.push(100, false); taps.reset();
  assert.equal(taps.push(200, false).rapidCount, 1);
  taps.push(300, true); taps.reset();
  assert.deepEqual(taps.push(400, false), { kind: 'tap', rapidCount: 1 });
});

test('head jitter does not become a moved or counted gesture', () => {
  const pet = new PetStroke(0, 0);
  for (const [x, y] of [[3, 4], [-3, -4], [0, 8], [0, 0]]) {
    assert.deepEqual(pet.move(x, y, true), { moved: false, counted: false });
  }
  assert.deepEqual(pet.move(9, 0, true), { moved: true, counted: false });
});

test('one long stroke counts once, regardless of speed or number of moves', () => {
  const pet = new PetStroke(0, 0);
  assert.deepEqual(pet.move(28, 0, true), { moved: true, counted: true });
  for (const x of [29, 100, 500, 1000]) assert.equal(pet.move(x, 0, true).counted, false);
});

test('return strokes count without lifting, with a ten-pixel reversal dead zone', () => {
  const pet = new PetStroke(0, 0);
  assert.equal(pet.move(40, 0, true).counted, true);
  assert.equal(pet.move(31, 0, true).counted, false);
  assert.equal(pet.move(39, 0, true).counted, false);
  assert.equal(pet.move(50, 0, true).counted, false);
  assert.equal(pet.move(40, 0, true).counted, false);
  assert.equal(pet.move(22, 0, true).counted, true);
  assert.equal(pet.move(0, 0, true).counted, false);
  assert.equal(pet.move(28, 0, true).counted, true);
});

test('vertical strokes and custom travel thresholds work in both directions', () => {
  const pet = new PetStroke(20, 100, 40);
  assert.equal(pet.move(22, 61, true).counted, false);
  assert.equal(pet.move(23, 60, true).counted, true);
  assert.equal(pet.move(23, 99, true).counted, false);
  assert.equal(pet.move(23, 100, true).counted, true);
});

test('outside motion never counts; re-entry discards old distance and direction', () => {
  const pet = new PetStroke(0, 0);
  assert.equal(pet.move(20, 0, true).counted, false);
  assert.equal(pet.move(100, 0, false).counted, false);
  assert.equal(pet.move(-100, 0, false).counted, false);
  assert.equal(pet.move(20, 0, true).counted, false);
  assert.equal(pet.move(20, 27, true).counted, false);
  assert.equal(pet.move(20, 28, true).counted, true);
  assert.equal(pet.move(20, 30, false).counted, false);
  assert.equal(pet.move(0, 0, true).counted, false);
  assert.equal(pet.move(28, 0, true).counted, true);
});

test('rapid back-and-forth movement produces exactly nine strokes', () => {
  const pet = new PetStroke(0, 0);
  let count = 0;
  for (let i = 0; i < 9; i++) count += Number(pet.move(i % 2 === 0 ? 40 : 0, 0, true).counted);
  assert.equal(count, 9);
});
